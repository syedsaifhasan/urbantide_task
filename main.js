// libraries
const express = require('express');
const upload = require("express-fileupload");
const Pool = require('pg').Pool

// express app for api requests
const app = express();
app.use(upload());
const port = 3000;
const host = '0.0.0.0';

// postgres docker container connection
const connection = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    port: 5432,
})

// execute sql queries
function executeQuery(connection, query){
    connection.query(query, (error, results) => {
        if (error) {
            throw error;
        }
        console.log('Query Executed!');
    });
}

// create table to data entry if needed
const query = 'CREATE TABLE IF NOT EXISTS data (' +
          'id serial PRIMARY KEY,' +
          'timestamp TIMESTAMP NOT NULL, ' +
          'value INT not null,' +
          'category VARCHAR(255) NOT NULL' +
          ');';
executeQuery(connection, query);

// insert rows into database
function insertData(connection, data) {
    let query = "INSERT INTO data(timestamp, value, category) VALUES";
    query = data.reduce((string, entry) => string += `('${entry.timestamp}', ${entry.value}, '${entry.category}'), `, query).slice(0,-2) + ';';
    executeQuery(connection, query);
}

// detect outliers based in inter-quartile range
function outlierDetector(array) {
    let values, q1, q3, iqr, maxValue, minValue;

    values = array.map(entry => parseInt(entry.value)).sort( (a, b) => a - b);

    if((values.length) % 4 === 0){
        q1 = values[(values.length / 4)];
        q3 = values[((values.length / 4) * 3)];
    } else {
        q1 = (values[Math.floor((values.length / 4) - 1)] + values[Math.ceil((values.length / 4) - 1)]) / 2;
        q3 = (values[(Math.floor((3 * values.length / 4) - 1))] + values[(Math.ceil((3 * values.length/ 4) - 1) )]) / 2;
    }
    iqr = q3 - q1;
    maxValue = q3 + iqr * 1.5;
    minValue = q1 - iqr * 1.5;
    return !!values.filter((x) => (x <= minValue) || (x >= maxValue)).length;
}

// get api to get csv files
app.post('/import', (req, res) => {
    // preprocess csv data
    csvData = req.files ? req.files.csv_file.data.toString('utf8').split('\n').map(row => row.split(',')) : null;
    if (!csvData) {
        res.send('No file selected');
        return;
    } // handle unloaded files
    header = csvData[0];
    rows = csvData.slice(1).map(row => {
        const entry = {};
        header.forEach((column, i) => entry[column] = row[i])
        return entry;
    })

    // detect outliers
    const outliersPresent = outlierDetector(rows);

    // insert data into database if no outliers present
    if (!outliersPresent) insertData(connection, rows);

    res.send(outliersPresent ? 'File not imported due to outliers present' : 'File uploaded!');
});

app.listen(port, host,  () => console.log(`Listening on ${host}:${port}!`))