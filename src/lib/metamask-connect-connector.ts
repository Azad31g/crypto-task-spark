// BROWSER-ONLY module. Imports @metamask/connect-evm, which touches browser
// globals — it must never enter the SSR / Cloudflare worker import graph.
// It is only imported from `appkit-runtime.tsx`, which itself is loaded lazily
// behind <ClientOnly>.
//
// Implementation follows the official MetaMask reference connector
// (MetaMask/connect-monorepo → integrations/wagmi/metamask-connector.ts):
// lazy singleton `createEVMClient`, EIP-1193 provider, `connect({ chainIds })`,
// `switchChain`, and account/chain/disconnect/display_uri event handlers.
import { createConnector } from "wagmi";
import {
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
  numberToHex,
  type Address,
  type Hex,
  type ProviderConnectInfo,
} from "viem";
import { createEVMClient, type MetamaskConnectEVM } from "@metamask/connect-evm";
import { robinhoodTestnet, APP_URL } from "./wagmi-config";
import { METAMASK_CONNECTOR_ID } from "./azox-wallet-layer";

const ROBINHOOD_HEX = numberToHex(robinhoodTestnet.id) as Hex; // 0xb626

// Hex chain ID -> read-only RPC URL, as required by `api.supportedNetworks`.
const SUPPORTED_NETWORKS: Record<Hex, string> = {
  [ROBINHOOD_HEX]: robinhoodTestnet.rpcUrls.default.http[0]!,
};

type Provider = ReturnType<MetamaskConnectEVM["getProvider"]>;

// wagmi's connector shape carries a `withCapabilities` generic on connect();
// we implement the plain (non-capabilities) variant, so the finished object is
// cast once to the exact shape createConnector expects.
type ConnectorShape = ReturnType<Parameters<typeof createConnector<Provider>>[0]>;

export function metaMaskConnect() {
  let client: MetamaskConnectEVM | undefined;
  let clientPromise: Promise<MetamaskConnectEVM> | undefined;

  return createConnector<Provider>((config) => {
    const onAccountsChanged = (accounts: readonly string[]) => {
      if (accounts.length === 0) config.emitter.emit("disconnect");
      else
        config.emitter.emit("change", {
          accounts: accounts.map((a) => getAddress(a)) as readonly Address[],
        });
    };
    const onChainChanged = (chainId: string) => {
      config.emitter.emit("change", { chainId: Number(chainId) });
    };
    const onDisconnect = () => {
      config.emitter.emit("disconnect");
    };
    const onConnect = (info: { chainId: string; accounts: Address[] }) => {
      config.emitter.emit("connect", {
        accounts: info.accounts.map((a) => getAddress(a)),
        chainId: Number(info.chainId),
      } as unknown as { accounts: readonly Address[]; chainId: number });
    };

    async function getClient() {
      if (client) return client;
      if (!clientPromise) {
        clientPromise = createEVMClient({
          dapp: { name: "AZOX Gateway", url: APP_URL },
          api: { supportedNetworks: SUPPORTED_NETWORKS },
          analytics: { enabled: false },
          // Do not add a duplicate EIP-6963 MetaMask provider on top of the
          // existing AppKit / injected discovery.
          skipAutoAnnounce: true,
          eventHandlers: {
            connect: onConnect,
            disconnect: onDisconnect,
            accountsChanged: onAccountsChanged,
            chainChanged: onChainChanged,
          },
        });
      }
      client = await clientPromise;
      return client;
    }

    const connector = {
      id: METAMASK_CONNECTOR_ID,
      name: "MetaMask",
      type: "metaMaskSDK" as const,

      async setup() {
        // No eager connection: the client is only built on explicit user action.
      },

      async getProvider() {
        const c = await getClient();
        return c.getProvider();
      },

      async connect({ chainId }: { chainId?: number } = {}) {
        try {
          const c = await getClient();
          const requested = chainId ? (numberToHex(chainId) as Hex) : ROBINHOOD_HEX;
          const result = await c.connect({ chainIds: [requested] });
          const accounts = result.accounts.map((a) => getAddress(a));
          let currentChainId = Number(result.chainId);
          if (chainId && currentChainId !== chainId) {
            const chain = await this.switchChain?.({ chainId }).catch(() => undefined);
            currentChainId = chain?.id ?? currentChainId;
          }
          return { accounts, chainId: currentChainId } as unknown as {
            accounts: readonly Address[];
            chainId: number;
          };
        } catch (error) {
          if (
            /user rejected|user denied|rejected the request/i.test(
              error instanceof Error ? error.message : String(error),
            )
          ) {
            throw new UserRejectedRequestError(error as Error);
          }
          throw error;
        }
      },

      async disconnect() {
        const c = await getClient();
        await c.disconnect();
      },

      async getAccounts() {
        const c = await getClient();
        return c.accounts.map((a) => getAddress(a)) as readonly Address[];
      },

      async getChainId() {
        const c = await getClient();
        const hex = c.getChainId();
        return hex ? Number(hex) : robinhoodTestnet.id;
      },

      async isAuthorized() {
        try {
          const c = await getClient();
          return c.accounts.length > 0;
        } catch {
          return false;
        }
      },

      async switchChain({ chainId }: { chainId: number }) {
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) throw new SwitchChainError(new Error("Chain not found"));
        try {
          const c = await getClient();
          await c.switchChain({
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
          throw new SwitchChainError(error as Error);
        }
      },

      onAccountsChanged,
      onChainChanged,
      onDisconnect,
      onConnect: onConnect as unknown as (connectInfo: ProviderConnectInfo) => void,
    };

    return connector as unknown as ConnectorShape;
  });
}
