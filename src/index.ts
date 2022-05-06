import Parser from "rss-parser";
import axios from "axios";
import * as stream from "stream";
import { promisify } from "util";
import {
  createWriteStream,
  mkdir as mkdirAsync,
  access as accessAsync,
} from "fs";
import path from "path";

const mkdir = promisify(mkdirAsync);
const access = promisify(accessAsync);
const finished = promisify(stream.finished);

let parser = new Parser();

async function main() {
  let feed = await parser.parseURL("https://musicforprogramming.net/rss.xml");

  const chunk: string[] = [];
  const chunkSize = 5;

  const items = [...feed.items].filter(hasEnclosure);

  console.log(`Found ${items.length} episodes with mp3 files.`);

  let remainingFiles = items.length;

  for (const item of items) {
    chunk.push(item.enclosure.url);
    if (chunk.length >= chunkSize) {
      displayDownloadProgress(chunk.length, (remainingFiles -= chunk.length));
      await Promise.all(
        chunk.map((url) => {
          const fileName = url.replace(/.*\//, "");
          return downloadMp3(url, fileName);
        })
      );
      chunk.length = 0;

      if (remainingFiles > 0) {
        const wait = randBetween(2, 5);
        console.log(`Politely waiting ${wait} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      }
    }
  }

  if (chunk.length > 0) {
    displayDownloadProgress(chunk.length, (remainingFiles -= chunk.length));
    await Promise.all(
      chunk.map((url) => {
        const fileName = url.replace(/.*\//, "");
        return downloadMp3(url, fileName);
      })
    );
  }

  console.log("Done!");
}

async function downloadMp3(url: string, filename: string) {
  const downloadsDir = path.join(process.cwd(), "downloads");
  const file = path.join(downloadsDir, filename);
  try {
    await access(file);
    console.log(`'${filename}' already downloaded!`);
    return;
  } catch (e) {
    try {
      const writer = createWriteStream(file);
      await mkdir(downloadsDir, { recursive: true });
      const { data } = await axios.get(url, { responseType: "stream" });
      data.pipe(writer);
      return finished(writer);
    } catch (e) {
      console.log(`Failed downloading '${filename}'!`);
    }
  }
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function displayDownloadProgress(
  currentDownloads: number,
  remaining: number
): void {
  console.log(
    `Downloading ${currentDownloads} files, remaining ${remaining}. Please wait...`
  );
}

function hasEnclosure(item: any): item is { enclosure: { url: string } } {
  return "enclosure" in item && item.enclosure.url?.endsWith(".mp3");
}

main();
