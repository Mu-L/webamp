import * as Skins from "./data/skins";
import fs from "fs";
import md5Buffer from "md5";
import * as S3 from "./s3";
import Shooter from "./shooter";
import _temp from "temp";
import { SkinType } from "./types";
import SkinModel from "./data/SkinModel";
import UserContext from "./data/UserContext";
import JSZip from "jszip";
import { setHashesForSkin } from "./skinHash";

// TODO Move this into the function so that we clean up on each run?
const temp = _temp.track();

// TODO
// Extract the readme
// Extract the emails
// Upload to Internet Archive
// Store the Internet Archive item name
// Construct IA Webamp UR
export type Result =
  | { md5: string; status: "FOUND" }
  | { md5: string; status: "ADDED"; skinType: SkinType };

export async function addSkinFromBuffer(
  buffer: Buffer,
  filePath: string,
  uploader: string
): Promise<Result> {
  const ctx = new UserContext();
  const md5 = md5Buffer(buffer);
  if (await SkinModel.exists(ctx, md5)) {
    return { md5, status: "FOUND" };
  }

  // Note: This will thrown on invalid skins.
  const zip = await JSZip.loadAsync(buffer);
  const skinType = await getSkinType(zip);

  switch (skinType) {
    case "CLASSIC":
      return addClassicSkinFromBuffer(ctx, buffer, md5, filePath, uploader);
    case "MODERN":
      return addModernSkinFromBuffer(buffer, md5, filePath, uploader);
  }
}

async function addModernSkinFromBuffer(
  buffer: Buffer,
  md5: string,
  filePath: string,
  uploader: string
): Promise<Result> {
  const tempFile = temp.path({ suffix: ".wal" });
  fs.writeFileSync(tempFile, buffer);
  await S3.putSkin(md5, buffer, "wal");

  await Skins.addSkin({
    md5,
    filePath,
    uploader,
    modern: true,
  });

  return { md5, status: "ADDED", skinType: "MODERN" };
}

async function addClassicSkinFromBuffer(
  ctx: UserContext,
  buffer: Buffer,
  md5: string,
  filePath: string,
  uploader: string
): Promise<Result> {
  const tempFile = temp.path({ suffix: ".wsz" });
  fs.writeFileSync(tempFile, buffer);
  const tempScreenshotPath = temp.path({ suffix: ".png" });

  const logLines: string[] = [];
  const logger = (message: string) => logLines.push(message);
  await Shooter.withShooter(
    (shooter) =>
      shooter.takeScreenshot(tempFile, tempScreenshotPath, {
        minify: true,
        md5,
      }),
    logger
  );

  try {
    await S3.putScreenshot(md5, fs.readFileSync(tempScreenshotPath));
  } catch (e) {
    console.error("Screenshot log lines:", logLines);
    throw e;
  }
  await S3.putSkin(md5, buffer, "wsz");

  await Skins.addSkin({
    md5,
    filePath,
    uploader,
    modern: false,
  });

  const skin = await SkinModel.fromMd5Assert(ctx, md5);

  await setHashesForSkin(skin);

  await Skins.updateSearchIndex(ctx, md5);

  return { md5, status: "ADDED", skinType: "CLASSIC" };
}

export async function getSkinType(zip: JSZip): Promise<SkinType> {
  if (zip.file(/main\.bmp$/i).length > 0) {
    return "CLASSIC";
  }
  if (zip.file(/skin\.xml$/i).length > 0) {
    return "MODERN";
  }
  throw new Error("Not a skin");
}
