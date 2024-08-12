process.env.GOOGLE_APPLICATION_CREDENTIALS = "cloud_function_executor.json";
const { Storage } = require("@google-cloud/storage");
const pug = require("pug");
const fs = require("fs");

const listFolders = async (req, res) => {
  const bucketName = "automation-test-reports";
  const storage = new Storage();
  const htmlStream = storage.bucket(bucketName).file("index.html");

  try {
    const [, , { prefixes: files }] = await storage
      .bucket(bucketName)
      .getFiles({
        delimiter: "/",
        autoPaginate: false,
      });

    const pugTemplate = fs.readFileSync(
      "./5_gcp_client_functions/index.pug",
      "utf8"
    );

    let indexHtml = pug.render(pugTemplate, { items: files });

    await htmlStream.save(indexHtml, {
      metadata: {
        contentType: "text/html", // Set content type for proper rendering
        cacheControl: "no-store",
      },
    });

    res.set("Access-Control-Allow-Origin", "https://storage.googleapis.com");
    res.status(200).send("Build Report Created");
  } catch (err) {
    console.error("Error listing folders:", err);
    res.status(500).send("Error listing folders" + ": " + err.message);
  }
};

listFolders();
