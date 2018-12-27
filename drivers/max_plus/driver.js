'use strict';

const Homey = require('homey');
const AbstractDriver = require('../abstract_driver');

class MaxPlusDriver extends AbstractDriver {

    toHomeyDevice(cube, device, deviceInfo) {
        if(device.device_type == 2) {
            return super.toHomeyDevice(cube, device, deviceInfo);
        }
        return false;
    }
}

module.exports = MaxPlusDriver;