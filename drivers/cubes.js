'use strict';

const MaxCube = require('maxcube2');

class Cubes {

    constructor() {
        this.cubes = {};
    }

    get(ip) {
        // There is already a connection, add to next list.
        if(this.cubes[ip]) {
            return new Promise((resolve, reject) => {
                this.cubes[ip].next.push(resolve);
            });
        }

        // Create new connection.
        return new Promise((resolve, reject) => {
            var cube = {
                cube: new MaxCube(ip, 62910),
                next: [resolve],
            }

            // When connected start the processing of this client.
            cube.cube.on("connected", () => {
                cube.cube.getDeviceStatus().then(() => {        
                    this.start(ip);             
                });
            });

            // Overload closing, so that the next user can use the connection for his purpose.
            // Doing to much in parrallel overloads the cube.
            cube.cube.realClose = cube.cube.close;
            cube.cube.close = () => {
                this.close(ip);
            };

            this.cubes[ip] = cube;            
        })        
    }

    start(ip) {
        var next = this.cubes[ip].next.shift();
        this.cubes[ip].busy = next;

        // Check if the client reacts withing 20s. Else the system is in deadlock.
        // So process further instead of wait forever.
        setTimeout(() => {
            if(this.cubes[ip].busy == next) {
                this.close(ip);
            }
        }, 20000);

        next(this.cubes[ip].cube);
    }

    close(ip) {
        // When closing, check if there are next clients that want to use the connection.
        // If not, still wait 2s and then close the connection.
        if(this.cubes[ip].next.length == 0) {
            setTimeout(() => {
                if(this.cubes[ip].next.length == 0) {
                    this.cubes[ip].cube.realClose();
                    this.cubes[ip] = false;
                }
            }, 2000);
        }
        else {
            this.start(ip);
        }
    }
}

module.exports = new Cubes();