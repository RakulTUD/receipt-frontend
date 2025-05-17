var http = require('http');
var url = require('url');
const { parse } = require('querystring');
var fs = require('fs');
const https = require('https');

// Load config file
let defaultConfig;
try {
    const config = require('./config/config.json');
    defaultConfig = config.development;
    console.log('Config loaded successfully:', defaultConfig);
} catch (error) {
    console.error('Error loading config.json:', error);
    defaultConfig = {
        config_id: 'development',
        app_name: 'receipt-frontend',
        webservice_host: 'localhost',
        webservice_port: '8080',
        exposedPort: '3000'
    };
}

// Set global config with explicit PORT override
const port = process.env.PORT || defaultConfig.exposedPort;
const backendUrl = process.env.BACKEND_URL || `${defaultConfig.webservice_host}:${defaultConfig.webservice_port}`;
global.gConfig = {
    config_id: defaultConfig.config_id,
    app_name: defaultConfig.app_name,
    backend_url: backendUrl,
    exposedPort: port
};

console.log(`Starting server on port ${global.gConfig.exposedPort}`);
console.log(`Backend URL: ${global.gConfig.backend_url}`);

// HTML constants
const header = '<!doctype html><html><head>';
const body = '</head><body><div id="container">' +
             '<div id="logo">' + global.gConfig.app_name + '</div>' +
             '<div id="space"></div>' +
             '<div id="form">' +
             '<form id="form" action="/" method="post"><center>' +
             '<label class="control-label">Name:</label>' +
             '<input class="input" type="text" name="name" required/><br />' +
             '<label class="control-label">Ingredients:</label>' +
             '<input class="input" type="text" name="ingredients" required/><br />' +
             '<label class="control-label">Prep Time:</label>' +
             '<input class="input" type="number" name="prepTimeInMinutes" required/><br />';
const submitButton = '<button class="button button1">Submit</button></div></form>';
const endBody = '</div></body></html>';

const server = http.createServer(function (req, res) {
    console.log(`Received request: ${req.method} ${req.url}`);

    if (req.url === '/favicon.ico') {
        res.writeHead(200, {'Content-Type': 'image/x-icon'});
        res.end();
        console.log('Favicon requested');
        return;
    }

    res.writeHead(200, {'Content-Type': 'text/html'});

    try {
        const fileContents = fs.readFileSync('./public/default.css', {encoding: 'utf8'});
        res.write(header);
        res.write('<style>' + fileContents + '</style>');
        res.write(body);
        res.write(submitButton);
    } catch (error) {
        console.error('Error reading default.css:', error);
        res.write('<div id="logo" style="color: red;">Error loading styles. Please try again.</div>');
    }

    let timeout = 0;

    if (req.method === 'POST') {
        timeout = 2000;
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const post = parse(body);
                const myJSONObject = {
                    name: post.name,
                    ingredients: post.ingredients.split(',').map(item => item.trim()),
                    prepTimeInMinutes: parseInt(post.prepTimeInMinutes)
                };

                console.log('Sending recipe to backend:', JSON.stringify(myJSONObject, null, 2));

                const backendUrlParsed = new URL(backendUrl.startsWith('http') ? backendUrl : `http://${backendUrl}`);
                const options = {
                    hostname: backendUrlParsed.hostname,
                    path: '/recipe',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    port: backendUrlParsed.port || (backendUrlParsed.protocol === 'https:' ? 443 : 80)
                };

                console.log('POST request options:', options);

                const req2 = (backendUrlParsed.protocol === 'https:' ? https : http).request(options, (resp) => {
                    let data = '';
                    resp.on('data', (chunk) => {
                        data += chunk;
                    });
                    resp.on('end', () => {
                        console.log(`Backend POST response: ${resp.statusCode} ${data}`);
                        if (resp.statusCode === 201) {
                            res.write('<div id="space"></div>');
                            res.write('<div id="logo" style="color: green;">New recipe saved successfully!</div>');
                            res.write('<div id="space"></div>');
                        } else {
                            res.write('<div id="space"></div>');
                            res.write('<div id="logo" style="color: red;">Error saving recipe. Please try again.</div>');
                            res.write('<div id="space"></div>');
                        }
                    });
                });

                req2.on('error', (error) => {
                    console.error('Error sending recipe to backend:', error);
                    res.write('<div id="space"></div>');
                    res.write('<div id="logo" style="color: red;">Error connecting to backend. Please try again.</div>');
                    res.write('<div id="space"></div>');
                });

                req2.write(JSON.stringify(myJSONObject));
                req2.end();
            } catch (error) {
                console.error('Error processing recipe:', error);
                res.write('<div id="space"></div>');
                res.write('<div id="logo" style="color: red;">Error processing recipe. Please try again.</div>');
                res.write('<div id="space"></div>');
            }
        });
    }

    setTimeout(function() {
        const backendUrlParsed = new URL(backendUrl.startsWith('http') ? backendUrl : `http://${backendUrl}`);
        const options = {
            hostname: backendUrlParsed.hostname,
            path: '/recipes',
            method: 'GET',
            port: backendUrlParsed.port || (backendUrlParsed.protocol === 'https:' ? 443 : 80)
        };

        console.log('GET request options:', options);

        const req = (backendUrlParsed.protocol === 'https:' ? https : http).request(options, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                try {
                    res.write('<div id="space"></div>');
                    res.write('<div id="logo">Your Previous Recipes</div>');
                    res.write('<div id="space"></div>');
                    res.write('<div id="results">Name | Ingredients | PrepTime');
                    res.write('<div id="space"></div>');

                    const myArr = JSON.parse(data);
                    if (myArr && myArr.length > 0) {
                        for (let i = 0; i < myArr.length; i++) {
                            res.write(myArr[i].name + ' | ' + myArr[i].ingredients.join(', ') + ' | ');
                            res.write(myArr[i].prepTimeInMinutes + '<br/>');
                        }
                    } else {
                        res.write('No recipes found.<br/>');
                    }
                    res.write('</div><div id="space"></div>');
                } catch (error) {
                    console.error('Error displaying recipes:', error);
                    res.write('<div id="space"></div>');
                    res.write('<div id="logo" style="color: red;">Error loading recipes. Please try again.</div>');
                    res.write('<div id="space"></div>');
                }
                res.end(endBody);
            });
        });

        req.on('error', (error) => {
            console.error('Error fetching recipes:', error);
            res.write('<div id="space"></div>');
            res.write('<div id="logo" style="color: red;">Error connecting to backend. Please try again.</div>');
            res.write('<div id="space"></div>');
            res.end(endBody);
        });

        req.end();
    }, timeout);
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
});

// Start the server
try {
    server.listen(global.gConfig.exposedPort, () => {
        console.log(`Server successfully running on port ${global.gConfig.exposedPort}`);
    });
} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}