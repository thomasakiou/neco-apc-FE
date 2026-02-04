
const fs = require('fs');
const openapi = JSON.parse(fs.readFileSync('g:/Projects/neco-apcic-manager/neco-apcic-manager-FE/openapi.json', 'utf8'));
const schemaName = 'Body_upload_hod_apc_api_hod_apc_upload_post';
const schema = openapi.components.schemas[schemaName];
console.log(JSON.stringify(schema, null, 2));
