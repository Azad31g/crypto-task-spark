import boxAsset from "@/assets/azox/box.png.asset.json";
import clickerAsset from "@/assets/azox/clicker-frenzy.png.asset.json";
import damaAsset from "@/assets/azox/dama.png.asset.json";
import globalButtonAsset from "@/assets/azox/global-button.png.asset.json";
import questionDayAsset from "@/assets/azox/question-day.png.asset.json";
import shootAsset from "@/assets/azox/shoot.png.asset.json";
import snakeAsset from "@/assets/azox/snake.png.asset.json";
import takBomAsset from "@/assets/azox/tak-bom.png.asset.json";
import tokenAsset from "@/assets/azox/token.png.asset.json";
import videoAdsAsset from "@/assets/azox/video-ads.png.asset.json";
import xoAsset from "@/assets/azox/xo.png.asset.json";

export const AZOX_IMAGES = {
  box: boxAsset.url,
  "clicker-frenzy": clickerAsset.url,
  dama: damaAsset.url,
  "global-button": globalButtonAsset.url,
  "question-day": questionDayAsset.url,
  shoot: shootAsset.url,
  snake: snakeAsset.url,
  "tak-bom": takBomAsset.url,
  token: tokenAsset.url,
  "video-ads": videoAdsAsset.url,
  xo: xoAsset.url,
} as const;

export type AzoxImageKey = keyof typeof AZOX_IMAGES;
