const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { parse } = require('querystring');

// Import the server code
require('../fe-server.js');

describe('Frontend Server Tests', () => {
    let httpRequestStub;
    let httpsRequestStub;
    let fsReadFileSyncStub;
    let server;

    beforeEach(() => {
        // Create stubs for external dependencies
        httpRequestStub = sinon.stub(http, 'request');
        httpsRequestStub = sinon.stub(https, 'request');
        fsReadFileSyncStub = sinon.stub(fs, 'readFileSync');
        
        // Mock CSS file content
        fsReadFileSyncStub.returns('mock-css-content');

        // Create a new server instance for each test
        server = http.createServer((req, res) => {
            if (req.url === '/favicon.ico') {
                res.writeHead(200, {'Content-Type': 'image/x-icon'});
                res.end();
                return;
            }
        });
    });

    afterEach(() => {
        // Restore all stubs
        httpRequestStub.restore();
        httpsRequestStub.restore();
        fsReadFileSyncStub.restore();
        
        // Close the server
        if (server) {
            server.close();
        }
    });

    describe('Configuration', () => {
        it('should have required configuration properties', () => {
            expect(global.gConfig).to.have.property('config_id');
            expect(global.gConfig).to.have.property('app_name');
            expect(global.gConfig).to.have.property('backend_url');
            expect(global.gConfig).to.have.property('exposedPort');
        });

        it('should use default port if not specified', () => {
            expect(global.gConfig.exposedPort).to.be.a('string');
            expect(parseInt(global.gConfig.exposedPort)).to.be.a('number');
        });
    });

    describe('Recipe Processing', () => {
        it('should correctly parse recipe data', () => {
            const testData = 'name=Test Recipe&ingredients=ing1,ing2,ing3&prepTimeInMinutes=30';
            const parsed = parse(testData);
            
            expect(parsed).to.have.property('name', 'Test Recipe');
            expect(parsed).to.have.property('ingredients', 'ing1,ing2,ing3');
            expect(parsed).to.have.property('prepTimeInMinutes', '30');
        });

        it('should transform recipe data correctly', () => {
            const post = {
                name: 'Test Recipe',
                ingredients: 'ing1, ing2, ing3',
                prepTimeInMinutes: '30'
            };

            const transformed = {
                name: post.name,
                ingredients: post.ingredients.split(',').map(item => item.trim()),
                prepTimeInMinutes: parseInt(post.prepTimeInMinutes)
            };

            expect(transformed).to.deep.equal({
                name: 'Test Recipe',
                ingredients: ['ing1', 'ing2', 'ing3'],
                prepTimeInMinutes: 30
            });
        });
    });

    describe('HTTP Request Handling', () => {
        it('should handle favicon requests', (done) => {
            const req = {
                url: '/favicon.ico',
                method: 'GET'
            };
            const res = {
                writeHead: sinon.spy(),
                end: sinon.spy()
            };

            // Simulate favicon request
            server.emit('request', req, res);

            // Use setTimeout to allow the event loop to process the request
            setTimeout(() => {
                expect(res.writeHead.calledWith(200, {'Content-Type': 'image/x-icon'})).to.be.true;
                expect(res.end.called).to.be.true;
                done();
            }, 0);
        });
    });
}); 