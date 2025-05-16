
var http = require('http');
var url = require('url');
const { parse } = require('querystring');
var fs = require('fs');

//Loading the config fileContents
const config = require('./config/config.json');
const defaultConfig = config.development;
global.gConfig = {
	config_id: defaultConfig.config_id,
	app_name: defaultConfig.app_name,
	webservice_host: process.env.BACKEND_HOST || defaultConfig.webservice_host,
	webservice_port: process.env.BACKEND_PORT || defaultConfig.webservice_port,
	exposedPort: defaultConfig.exposedPort
  };

//Generating some constants to be used to create the common HTML elements.
var header = '<!doctype html><html>'+
		     '<head>';
				
var body =  '</head><body><div id="container">' +
				 '<div id="logo">' + global.gConfig.app_name + '</div>' +
				 '<div id="space"></div>' +
				 '<div id="form">' +
				 '<form id="form" action="/" method="post"><center>'+
				 '<label class="control-label">Name:</label>' +
				 '<input class="input" type="text" name="name" required/><br />'+			
				 '<label class="control-label">Ingredients:</label>' +
				 '<input class="input" type="text" name="ingredients" required/><br />'+
				 '<label class="control-label">Prep Time:</label>' +
				 '<input class="input" type="number" name="prepTimeInMinutes" required/><br />';

var submitButton = '<button class="button button1">Submit</button>' +
				   '</div></form>';
				   
var endBody = '</div></body></html>';				   


http.createServer(function (req, res) {
	console.log(req.url)
 
	//This validation needed to avoid duplicated (i.e., twice!) get / calls (due to the favicon.ico)
	if (req.url === '/favicon.ico') {
		 res.writeHead(200, {'Content-Type': 'image/x-icon'} );
		 res.end();
		 console.log('favicon requested');
    }
	else
	{
		res.writeHead(200, {'Content-Type': 'text/html'});

		var fileContents = fs.readFileSync('./public/default.css', {encoding: 'utf8'});
		res.write(header);
		res.write('<style>' + fileContents + '</style>');
		res.write(body);
		res.write(submitButton);

		const http = require('http');
		var timeout = 0
		
		// If POST, try saving the new recipe first (then still showing the existing recipes).
		//********************************************************
		if (req.method === 'POST') {
			timeout = 2000

			//Get the POST data
			//------------------------------
			var myJSONObject = {};
			var qs = require('querystring');

			let body = '';
			req.on('data', chunk => {
				body += chunk.toString();
			});
			req.on('end', () => {
				try {
					var post = qs.parse(body);
					myJSONObject["name"] = post["name"];
					myJSONObject["ingredients"] = post["ingredients"].split(',').map(item => item.trim());
					myJSONObject["prepTimeInMinutes"] = parseInt(post["prepTimeInMinutes"]);
					
					console.log("Sending recipe to backend:", JSON.stringify(myJSONObject, null, 2));
					
					//Send the data to the WS.
					//------------------------------
					const options = {
						hostname: global.gConfig.webservice_host,
						port: global.gConfig.webservice_port,
						path: '/recipe',
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json'
						}
					};

					const req2 = http.request(options, (resp) => {
						let data = '';
						resp.on('data', (chunk) => {
							data += chunk;
						});

						resp.on('end', () => {
							console.log("Backend response:", data);
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

		// Get and display existing recipes
		setTimeout(function(){
			const options = {
				hostname: global.gConfig.webservice_host,
				port: global.gConfig.webservice_port,
				path: '/recipes',
				method: 'GET'
			};

			const req = http.request(options, (resp) => {
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
	}}
).listen(global.gConfig.exposedPort);
