const { Readable, Transform, Writable } = require("stream");
const { serializeError } = require("serialize-error");
const csv = require("fast-csv");
const fs = require("fs");
const dot = require("dot-object");
const _ = require("lodash");
const { result } = require("lodash");
const puppeteer = require("puppeteer");
const axios = require("axios");

const index = 0;

const csvParser = csv.parse({
  headers: true,
  objectMode: true,
  highWaterMark: 1,
});

async function getDomainName(companyName) {
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.goto(
  //   `https://www.google.com/search?q=${encodeURIComponent(companyName)}&num=1`,
  // );

  // const link = await page.$eval('div#search div.g a', (el) => el.href);
  // await browser.close();
  // const domain = link.match(/^https?:\/\/(?:www\.)?([^/]+)/i)[1];
  const resp = await axios.get(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${companyName}`
  );
  // console.log(resp);
  if (resp.data.length == 0) {
    return "";
  }
  if (!resp.data[0].domain) {
    return "";
  }
  console.log(resp.data[0].domain);
  return resp.data[0].domain;
}

const readableStream = fs.createReadStream("input.csv").pipe(csvParser);
const totalRequest = 0;

const transformer = new Transform({
  objectMode: true,
  highWaterMark: 100,
  transform: async (data, encoding, callback) => {
    try {
      getDomainName(data["Company Name"]).then((domain) => {
        data["Domain Name"] = domain;
        csvFormatter.write(data);
      });

      callback(null, data);
    } catch (err) {
      callback(err);
    }
  },
});

transformer.on("data", (data) => {
  // console.log(`transformer: data: ${JSON.stringify(data)}`);
  console.log("Total Req:", index);
});

transformer.on("error", (error) => {
  const e = serializeError(error);
  console.log(`transformer: ERROR: ${JSON.stringify(e)}`);
});

const csvFormatter = csv.format({
  objectMode: true,
  headers: true,
});

const writableStream = fs
  .createWriteStream("./output.csv", {
    metadata: {
      contentType: "text/csv",
    },
  })
  .on("error", (error) => {
    throw error;
  });

writableStream.on("finish", async () => {
  console.log("writableStream FINISH");
  writableStream.destroy();
});

writableStream.on("close", async () => {
  console.log("writableStream Close");
  return "Request Served";
});

readableStream.pipe(transformer);
csvFormatter.pipe(writableStream);
