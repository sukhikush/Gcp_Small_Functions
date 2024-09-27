
process.env.GOOGLE_APPLICATION_CREDENTIALS='./localaccess.json'
const csv = require('fast-csv');
const { serializeError } = require('serialize-error');
const { Storage } = require('@google-cloud/storage');
const { Transform, Writable } = require('stream');
const storage = new Storage();
const fs = require("fs");
let fileErrorObj = require("./ErrorReff.json");
let TotalFileProcessingData = require("./processedFile/TotalCtnData.json");
let folderMap = require("./folderMapping.json");
let glbCnt = {"totalProcessd":0};
let folderName = "";
let processFileName = "";
let allIndustryName = [];



function createWriterObject(folderName){
  //Make Directory
  fs.mkdirSync(__dirname + `/processedFile/${folderName}`, { recursive: true }, (err) => {
    if (err) throw err;
  });

  //Create Write Object
  for (let i in fileErrorObj){
    fileErrorObj[i].writeObj = '';
    fileErrorObj[i].writeObj = csv.format({ headers: true });
    fileErrorObj[i].writeObj.pipe(fs.createWriteStream(`./processedFile/${folderName}/${i}.csv`,{flags:'a'}));
    glbCnt[i] = 0;
  }

  glbCnt["totalProcessd"] = 0;
}

function getWriteObject(errStr){
  var ret = {},found = false;
  for (let i in fileErrorObj){
    //if(fileErrorObj[i].errorKey.toLocaleLowerCase().indexOf(errStr.toLocaleLowerCase()) > -1){
    if(errStr.toLocaleLowerCase().indexOf(fileErrorObj[i].errorKey.toLocaleLowerCase()) > -1){
      ret.key = i;
      ret.writeObj = fileErrorObj[i].writeObj;
      found = true;
      break;
    }
  }
  if (!found){
    ret.key = "OtherError";
    ret.writeObj = fileErrorObj["OtherError"].writeObj;
  }
  
  if( ret.key == 'Incorrect_Industry'){
    let tempIn = errStr.replaceAll("Bad Industry '","").replaceAll("' for the Account","");
    
    if(allIndustryName.indexOf(tempIn) < 0){
        allIndustryName.push(tempIn);
    }
  }
  return ret;
}

async function processIndvidualFile(){
    return new Promise((res,rej) => {
        try{
            //da-temp-files/files/jobErrorReports/b469dd78-0645-46b1-8f1e-75febc2f12e9_error_report.csv
            // csvReader
            const csvReader = storage
            .bucket('da-temp-files')
            .file('files/jobErrorReports/'+processFileName+'.csv')
            .createReadStream();

            csvReader.on('error', (error) => {
                let e = serializeError(error);
                console.log(`\t csvReader: ERROR1: ${JSON.stringify(e)}`);
                rej(`Error From File Read gcp file ${processFileName}`);
            });

            // csvParser
            const csvParser = csv.parse({
                headers: true,
                objectMode: true,
                highWaterMark: 1,
            });

            csvParser.on('error', (error) => {
                let e = serializeError(error);
                console.log(`\t csvParser: ERROR: ${JSON.stringify(e)}`);
                rej(`Error From csvParser file ${processFileName}`);
            });

            // csvTransformer
            const transformer = new Transform({
                objectMode: true,
                highWaterMark: 1,
                transform: async (data, encoding, callback) => {
                try {
                    var ret = getWriteObject(data.description);
                    var newObj = {
                    "Error_Desc":data.description,
                    ...JSON.parse(data.rowContent)
                    }
                    ret.writeObj.write(newObj);
                    glbCnt[ret.key]++;
                    glbCnt["totalProcessd"]++;
                    //console.log(`\t Processing File ${folderName} : Current Record Number ${glbCnt["totalProcessd"]}`);
                    callback(null, newObj);
                } catch (err) {
                    callback(err);
                }
                },
            });

            transformer.on('error', (error) => {
                let e = serializeError(error);
                console.log(`\t transformer: ERROR: ${JSON.stringify(e)}`);
                rej(`Error From transformer file ${processFileName}`);
            });

            transformer.on('data', (data) => {
            //console.log(`\t transformer: data: ${JSON.stringify(data)}`);
            });

            createWriterObject(folderName);

            // var newReadr = fs.createReadStream(processFileName+".csv");

            csvReader.pipe(csvParser).pipe(transformer).on('end',() => {
                console.log(`\t Ended Transform ${folderName}`);
                console.log(`\t Counter for ${folderName} `,JSON.stringify(glbCnt,null,0));
                var finalFile = fs.createWriteStream(`./processedFile/${folderName}/processedData.json`,{flags:'a'});
                finalFile.write(JSON.stringify(glbCnt,null,1));
                finalFile.end();
                res(glbCnt);
            });

        }catch(err){
            console.log("caught Error", err)
            rej(err)
        }
    });
}

function saveAllFileRecord(temp,folderName){
    return new Promise((resolve,rejects) => {
        try{
            for(let q in temp){
                TotalFileProcessingData[q] = (TotalFileProcessingData[q]?TotalFileProcessingData[q]:0) + temp[q]
            }
            console.log(`\t \t ${folderName} > TotalFileProcessingData`,JSON.stringify(TotalFileProcessingData,null,0));
            
            var finalFile = fs.createWriteStream(`./processedFile/TotalCtnData.json`);
            finalFile.write(JSON.stringify(TotalFileProcessingData,null,1));
            finalFile.end();

            var allIndustry = fs.createWriteStream(`./processedFile/TotalFunctionError.csv`);
            allIndustry.write(allIndustryName.toString().replaceAll(',','\r\n'));
            allIndustry.end();

            console.log(`\t \t Total Data Save End ${folderName}`);
            resolve(glbCnt);
        }catch(err){
            rejects(err)
        }
    });
}

async function init(){
    var TotalCtn = Object.keys(folderMap).length;
    var ctnproCount = 0;
    var isError = "";
    var limitProcess = 15;
    for (let fileName in folderMap){

        if(ctnproCount == limitProcess){
            break;
        }

        processFileName = fileName.replaceAll(".csv","");
        folderName = folderMap[processFileName]?folderMap[processFileName]:"unknowFiles";

        console.log(`Starting PRocessing for folder ${folderName} and File ${processFileName}`);

        await processIndvidualFile().then(async(t) => {
            if (typeof(t) === 'object'){
                await saveAllFileRecord(t,folderName);
            }else{
                console.log(t)
            }
            isError = "";
        }).catch((err) => {
            isError = "hasError";
            console.log("\t ErrorProcessing: ",err)
        });
        
        console.log(`Ending Processing for forler ${folderName} and File ${processFileName}`+"\r\n");

        ctnproCount++;
        await new Promise((res,rej)=>{
            try{
                fs.createWriteStream(`.logsProg`,{flags:'a'}).write(`Processed (${ctnproCount} - ${TotalCtn}) - ${isError}  Folder ${folderName} | ${processFileName}` + "\r\n");
                res('Done')
            }catch(err){
                rej(err)
            }
        })
    }
}

init();