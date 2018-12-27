'use strict';

const Homey = require('homey');
const dgram = require('dgram');
const Cubes = require('./cubes');

class AbstractMaxDriver extends Homey.Driver {

    toHomeyDevice(cube, device, deviceInfo) {
        return {
            "name": (device.device_name ? device.device_name : device.rf_address) + " ("+(deviceInfo.room_name ? deviceInfo.room_name : device.room_id)+")",
            "data": {
                "id": device.serialnumber,
                "type": device.device_type,   
            },
            "settings": {
                "cube_ip": cube.ip,
                "rf": device.rf_address
            }
        }
    }

    onPair( socket ) {

        var devices = []

        socket.on('list_devices', (data, callback) => {
            var busyFinding = 0;

            var checkIfDone = () => {
                if(busyFinding == 0) {
                    callback(null, devices);
                    busyFinding--;
                }
            }

            this.findCubes((cube) => {
                busyFinding++;

                Cubes.get(cube.ip).then((maxcube) => { 
                    var cubeDevices = maxcube.getDevices();
                    for(var key in cubeDevices) {
                        var device = cubeDevices[key];
                        var deviceInfo = maxcube.getDeviceInfo(device.rf_address);
                        var homeyDevice = this.toHomeyDevice(cube, device, deviceInfo);

                        if(homeyDevice) {
                            devices.push(homeyDevice);
                            socket.emit('list_devices', devices);
                        }
                    }
                    maxcube.close();

                    busyFinding--;
                    checkIfDone();
                });


            }, () => {
                checkIfDone();
            });   

        });

    }

    findCubes( callback, finished ){

        var socket = dgram.createSocket('udp4');
        var foundCubes = {};

        socket.bind(23272, '0.0.0.0', () => {
            socket.setBroadcast(true);

            socket.on('message', (data, rinfo) => {
                if(rinfo.size !== 26 || data.toString('ascii', 0, 8) !== 'eQ3MaxAp' || foundCubes[rinfo.address]) {
                    return;
                }

                var response = {
                    ip: rinfo.address,
                    serial: data.toString('ascii', 8, 18),
                    rf: data.toString('hex', 21, 24).toUpperCase(),
                    version: parseInt(data.toString('hex', 24, 26), 10).toString().split('').join('.'),
                };

                foundCubes[rinfo.address] = response;
                callback(response);
            });

            var message = new Buffer('eQ3Max*.**********I', 'ascii');
            socket.send(message, 0, message.length, 23272, '255.255.255.255');

            setTimeout(() => {
                socket.close();
                finished();
            }, 5000);
        });
    }
}

module.exports = AbstractMaxDriver;