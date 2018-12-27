'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {
	
	onInit() {
		this.log('MaxCube is running...');
	}
	
}

module.exports = MyApp;