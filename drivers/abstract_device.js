'use strict';

const Homey = require('homey');
const Cubes = require('./cubes');

class AbstractMaxDevice extends Homey.Device {

    onInit() {
        this.log('device init');

        this.tempBeforeRefresh = false;
        this.lastTargetValue = false;
        this.targetTemperatureInvalid = false;

        // Poll the information
        if(this.getSetting("poll_interval")) {
            setInterval(() => this.poll(), this.getSetting("poll_interval")*1000);
            this.poll();
        }

        // Actively refresh the information
        if(this.getSetting("data_refresh_interval")) {
            setInterval(() => this.refreshData(), this.getSetting("data_refresh_interval")*1000);
            this.refreshData();
        }

        // register a capability listener
        if(this.hasCapability("target_temperature")) {
            this.registerCapabilityListener('target_temperature', (value, opts, callback) => this.onCapabilityTargetTemperature(value, opts, callback));
        }
    }

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        
        if(this.tempBeforeRefresh)
            this.refreshDataUndo();
    }

    poll() {
        return Cubes.get(this.getSetting("cube_ip")).then((cube) => {
            this.log('poll')

            var device = cube.getDevice(this.getSetting("rf"));

            if(this.hasCapability("target_temperature"))
                this.setCapabilityValue("target_temperature", device.setpoint).catch(() => {this.log("target_temperature wrong")});
            if(this.hasCapability("measure_temperature") && device.temp != 0)
                this.setCapabilityValue("measure_temperature", device.temp).catch(() => {this.log("measure_temperature wrong")});
            if(this.hasCapability("thermostat_valve"))
                this.setCapabilityValue("thermostat_valve", device.valve/100).catch(() => {this.log("thermostat_valve wrong")});
            if(this.hasCapability("alarm_contact"))
                this.setCapabilityValue("alarm_contact", device.open).catch(() => {this.log("alarm_contact wrong")});


            cube.close();
        });
    }

    // We refresh the data by actively setting it one degree lower.
    refreshData() {
        return Cubes.get(this.getSetting("cube_ip")).then((cube) => {
            this.log('refresh data')

            var device = cube.getDevice(this.getSetting("rf"));

            if( // Not if we have changed the target temperature recently
                !this.targetTemperatureInvalid && 
                // Only in automatic and manual mode, not boost and vacation mode.
                (device.mode == "AUTOMATIC" || device.mode == "MANUAL") && 
                // Check if we have enough broadcast time
                cube.getCommStatus()["duty_cycle"] < this.getSetting("max_duty_cycle_refresh") &&
                // We already have changed the temperature
                this.tempBeforeRefresh == false
            ) {
                this.tempBeforeRefresh = device.setpoint;

                cube.setTemperature(this.getSetting("rf"), this.tempBeforeRefresh-1, device.mode).then(() => {
                    cube.close();                
                });

                setTimeout(() => {
                    this.refreshDataUndo();
                }, 120000)
            }
            else {
                cube.close();
            }
        });
    }

    // When the data is forced to be refreshed, we set the temperature one degree lower.
    // After certain time, we reset this with this function.
    refreshDataUndo() {
        Cubes.get(this.getSetting("cube_ip")).then((cube) => {
            this.log('refresh data undo')

            var device = cube.getDevice(this.getSetting("rf"));

            if(this.tempBeforeRefresh != false && 
                // Temperature has not been changed
                this.tempBeforeRefresh == device.setpoint+1 &&
                // Not if we have changed the target temperature recently
                !this.targetTemperatureInvalid && 
                // Only in automatic and manual mode, not boost and vacation mode.
                (device.mode == "AUTOMATIC" || device.mode == "MANUAL") 
            ) {
                cube.setTemperature(this.getSetting("rf"), this.tempBeforeRefresh, device.mode).then(() => {
                    this.tempBeforeRefresh = false;
                    cube.close();
                    this.poll();
                });
            }
            else {
                this.tempBeforeRefresh = false;
                cube.close();
            }
        });
    }

    onCapabilityTargetTemperature( value, opts, callback ) {
        // This function is called twice on every change. So debounce this.
        if(value == this.lastTargetValue) {
            return;
        }
        this.lastTargetValue = value;
        setTimeout(() => {
          if(this.lastTargetValue == value)
            this.lastTargetValue = false;
        }, 2000);

        // Also ignore the target temperature, so that the thermostat and cube has time to catch up.
        this.targetTemperatureInvalid = true;
        setTimeout(() => {
            this.targetTemperatureInvalid = false;
        }, this.getSetting("hold_refresh_after_change")*1000);

        // Do sending.
        return Cubes.get(this.getSetting("cube_ip")).then((cube) => {
            value = Math.round(value*2)/2;
            return cube.setTemperature(this.getSetting("rf"), value)
                .finally(() => cube.close());       
        });
    }
}

module.exports = AbstractMaxDevice;