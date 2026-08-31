// BROWSER-ONLY module. It follows the official MetaMask reference connector
// (MetaMask/connect-monorepo → integrations/wagmi/metamask-connector.ts):
// lazy singleton client created through a DYNAMIC import of
// `@metamask/connect-evm`, an EIP-1193 provider, `connect({ chainIds })`,
// `switchChain`, and accountsChanged / chainChanged / connect / disconnect /
// displayUri handlers.
//
// All `@metamask/connect-evm` imports at module scope are TYPE-ONLY, so this
// module carries no runtime dependency on the package until a user explicitly
// starts a MetaMask connection. That also keeps the SSR/worker graph clean.
//
// AZOX constraints: registered only in a Telegram Android Mini App, single
// configured chain Robinhood Testnet 46630 (0xb626), no deprecated
// @metamask/sdk packages.
import { createConnector } from "wagmi";
import {
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
  numberToHex,
  withRetry,
  withTimeout,
  type Address,
  type Hex,
  type ProviderConnectInfo,
} from "viem";
import type {
  EIP1193Provider,
  MetamaskConnectEVM,
  createEVMClient as CreateEVMClient,
} from "@metamask/connect-evm";
import { robinhoodTestnet, APP_URL } from "./wagmi-config";
import { METAMASK_CONNECTOR_ID } from "./azox-wallet-layer";

const ROBINHOOD_HEX = numberToHex(robinhoodTestnet.id) as Hex; // 0xb626

// Hex chain ID -> read-only RPC URL, as required by `api.supportedNetworks`.
const SUPPORTED_NETWORKS: Record<Hex, string> = {
  [ROBINHOOD_HEX]: robinhoodTestnet.rpcUrls.default.http[0]!,
};

/** MetaMask's official EIP-6963 rdns identifiers. */
const METAMASK_RDNS = [
  "io.metamask",
  "io.metamask.mobile",
  "io.metamask.flask",
] as const;

function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: number } | undefined)?.code;
  if (code === 4001) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /user rejected|user denied|rejected the request/i.test(message);
}

export function metaMaskConnect() {
  return createConnector<EIP1193Provider>((config) => {
    let instance: MetamaskConnectEVM | undefined;
    let instancePromise: Promise<MetamaskConnectEVM> | undefined;

    // --- official event bindings -------------------------------------------
    const onAccountsChanged = (accounts: string[] | readonly string[]) => {
      if (accounts.length === 0) config.emitter.emit("disconnect");
      else
        config.emitter.emit("change", {
          accounts: accounts.map((account) => getAddress(account)),
        });
    };

    const onChainChanged = (chainId: string) => {
      config.emitter.emit("change", { chainId: Number(chainId) });
    };

    const onConnect = async () => {
      const accounts = await connector.getAccounts();
      if (accounts.length === 0) return;
      config.emitter.emit("connect", {
        accounts,
        chainId: await connector.getChainId(),
      });
    };

    const onDisconnect = async (error?: Error) => {
      // Official behavior: MetaMask emits 1013 ("try again later") while it is
      // merely reconnecting. Only treat it as a real disconnect when the
      // account is actually gone.
      if ((error as { code?: number } | undefined)?.code === 1013) {
        const accounts = await connector.getAccounts().catch(() => []);
        if (accounts.length > 0) return;
      }
      config.emitter.emit("disconnect");
    };

    const onDisplayUri = (uri: string) => {
      config.emitter.emit("message", { type: "display_uri", data: uri });
    };

    async function getInstance(): Promise<MetamaskConnectEVM> {
      if (instance) return instance;
      if (!instancePromise) {
        instancePromise = (async () => {
          // Runtime import happens here only — never at module scope.
          const { createEVMClient } = (await import("@metamask/connect-evm")) as {
            createEVMClient: typeof CreateEVMClient;
          };
          return createEVMClient({
            dapp: { name: "AZOX Gateway", url: APP_URL },
            api: { supportedNetworks: SUPPORTED_NETWORKS },
            // Installed 2.1.1 supports both fields; AZOX opts out of analytics.
            analytics: { enabled: false, integrationType: "wagmi" },
            // Do not announce a duplicate EIP-6963 MetaMask provider on top of
            // the existing AppKit / injected discovery.
            skipAutoAnnounce: true,
            eventHandlers: {
              accountsChanged: onAccountsChanged,
              chainChanged: onChainChanged,
              connect: () => {
                void onConnect();
              },
              disconnect: () => {
                void onDisconnect();
              },
              displayUri: onDisplayUri,
            },
          });
        })();
      }
      instance = await instancePromise;
      return instance;
    }

    const connector = {
      id: METAMASK_CONNECTOR_ID,
      name: "MetaMask",
      type: "metaMask" as const,
      rdns: METAMASK_RDNS,

      async getProvider() {
        const client = await getInstance();
        return client.getProvider();
      },

      async connect<withCapabilities extends boolean = false>(parameters?: {
        chainId?: number | undefined;
        isReconnecting?: boolean | undefined;
        withCapabilities?: withCapabilities | boolean | undefined;
      }) {
        const client = await getInstance();
        try {
          const requestedChainIds = config.chains.map(
            (chain) => numberToHex(chain.id) as Hex,
          );
          const result = await client.connect({ chainIds: requestedChainIds });
          const accounts = result.accounts.map((account) => getAddress(account));

          let currentChainId = await this.getChainId();
          const desiredChainId = parameters?.chainId;
          if (desiredChainId && currentChainId !== desiredChainId) {
            const chain = await this.switchChain({ chainId: desiredChainId });
            currentChainId = chain.id;
          }

          // Minimal cast: this connector implements the plain (non-capability)
          // variant of wagmi's generic `connect` signature.
          return { accounts, chainId: currentChainId } as unknown as {
            accounts: withCapabilities extends true
              ? readonly { address: Address; capabilities: Record<string, unknown> }[]
              : readonly Address[];
            chainId: number;
          };
        } catch (error) {
          if (isUserRejection(error))
            throw new UserRejectedRequestError(error as Error);
          throw error;
        }
      },

      async disconnect() {
        const client = await getInstance();
        await client.disconnect();
      },

      async getAccounts(): Promise<readonly Address[]> {
        const client = await getInstance();
        const known = client.accounts;
        if (known.length > 0) return known.map((account) => getAddress(account));
        const provider = client.getProvider();
        const accounts = (await provider.request({
          method: "eth_accounts",
          params: [],
        })) as string[] | undefined;
        return (accounts ?? []).map((account) => getAddress(account));
      },

      async getChainId(): Promise<number> {
        const client = await getInstance();
        const known = client.getChainId();
        if (known) return Number(known);
        const provider = client.getProvider();
        const chainId = (await provider.request({
          method: "eth_chainId",
        })) as Hex | undefined;
        return chainId ? Number(chainId) : robinhoodTestnet.id;
      },

      async isAuthorized() {
        try {
          // Official pattern: the client may still be restoring its session, so
          // retry briefly instead of reading `accounts` a single time.
          const accounts = await withRetry(
            () =>
              withTimeout(() => this.getAccounts(), {
                timeout: 2_000,
                errorInstance: new Error("MetaMask account lookup timed out"),
              }),
            { delay: 200, retryCount: 3 },
          );
          return accounts.length > 0;
        } catch {
          return false;
        }
      },

      async switchChain({ chainId }: { chainId: number }) {
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) throw new SwitchChainError(new Error("Chain not found"));
        const client = await getInstance();
        try {
          await client.switchChain({
            chainId: numberToHex(chainId) as Hex,
            chainConfiguration: {
              chainId: numberToHex(chainId),
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [...chain.rpcUrls.default.http],
              ...(chain.blockExplorers?.default
                ? { blockExplorerUrls: [chain.blockExplorers.default.url] }
                : {}),
            },
          });
          config.emitter.emit("change", { chainId });
          return chain;
        } catch (error) {
          if (isUserRejection(error))
            throw new UserRejectedRequestError(error as Error);
          throw new SwitchChainError(error as Error);
        }
      },

      onAccountsChanged,
      onChainChanged,
      onConnect: (_connectInfo: ProviderConnectInfo) => {
        void onConnect();
      },
      onDisconnect: (error?: Error) => {
        void onDisconnect(error);
      },
    };

    return connector;
  });
}
