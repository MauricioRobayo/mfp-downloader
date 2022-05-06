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

  const urls = [...feed.items];

  let remainingFiles = urls.length;

  for (const url of urls) {
    if (url.enclosure?.url) {
      chunk.push(url.enclosure.url);
      if (chunk.length >= chunkSize) {
        displayDownloadProgress(chunk.length, (remainingFiles -= chunk.length));
        await Promise.all(
          chunk.map((url) => {
            const fileName = url.replace(/.*\//, "");
            return downloadMp3(url, fileName);
          })
        );
        chunk.length = 0;
        await politelyWait();
      }
    }
  }

  if (chunk.length > 0) {
    displayDownloadProgress(chunk.length, (remainingFiles -= chunk.length));
    await Promise.all(
      chunk.map((url) => {
        const fileName = url.replace(/.*\//, "");
        downloadMp3(url, fileName);
      })
    );
  }
}

async function downloadMp3(url: string, fileName: string) {
  const downloadsDir = path.join(process.cwd(), "downloads");
  const file = path.join(downloadsDir, fileName);
  try {
    await access(file);
    console.log(`${url} already downloaded!`);
    return;
  } catch (e) {
    try {
      const writer = createWriteStream(file);
      await mkdir(downloadsDir, { recursive: true });
      const { data } = await axios.get(url, { responseType: "stream" });
      data.pipe(writer);
      return finished(writer);
    } catch (e) {
      console.log(`Failed downloading ${url}!`);
    }
  }
}

function politelyWait() {
  const wait = randBetween(2, 5);
  console.log(`Politely waiting ${wait}  seconds...`);
  return new Promise((resolve) => setTimeout(resolve, wait));
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

main();
