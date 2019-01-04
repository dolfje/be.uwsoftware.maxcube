'use strict';

const Homey = require('homey');
const AbstractDriver = require('../abstract_driver');

class MaxPlusDriver extends AbstractDriver {

    toHomeyDevice(cube, device, deviceInfo) {
    	console.log("Device asked "+device.device_type);
        if(device.device_type == 6 || device.device_type == 4) {
        	console.log("Found device");
            return super.toHomeyDevice(cube, device, deviceInfo);
        }
        return false;
    }
}

module.exports = MaxPlusDriver;