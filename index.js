import { DateTime } from 'luxon';
import os from 'os';
const hostname = os.hostname();

function Logger(log4jsLogger, appName, env) {
    this.logger = log4jsLogger;
    this.source = appName;
    this.env = env;
    this.ver = process.env.VER ?? 'unknown';

    this._buildData = function(eventName, eventData = {}, level) {
        const data = {
            time: DateTime.now().toISO(),
            logLevel: level,
            eventName: eventName,
        };

        const dataOther = {
            host: hostname,
            source: this.source,
            env: this.env,
            ver: this.ver,
        };

        return {...data, ...eventData, ...dataOther};
    }

    this.info = function (eventName, eventData = {}) {
        const data = this._buildData(eventName, eventData, "info");
        this.logger.info(JSON.stringify(data));
    }

    this.warn = function(eventName, eventData = {}) {
        const data = this._buildData(eventName, eventData, "warn");
        this.logger.warn(JSON.stringify(data));
    }

    this.error = function(eventName, eventData = {}) {
        const data = this._buildData(eventName, eventData, "error");
        this.logger.error(JSON.stringify(data));
    }
}

export default Logger;
