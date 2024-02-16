import { DateTime } from 'luxon';
import log4js from 'log4js';
import os from 'os';

function Logger(appName) {
    this.hostname = os.hostname();
    this.source = appName;
    this.env = process.env.ENV ?? 'unknown';
    this.ver = process.env.VER ?? 'unknown';

    // https://github.com/log4js-node/log4js-node/blob/master/docs/layouts.md
    // will also write the color escape sequence to file, so better avoid it
    const log4jsLayout = {
        noColor: { type: 'messagePassThrough' },
        colored: {
            type: 'pattern',
            pattern: '%[%m%]'
        },
    };

    // note: type 'file' might fail to write if the app exits abruptly
    // aka if you use process.exit() or if the app crashes
    // you can use 'fileSync' but performance will be bad
    const log4jsConfig = {
        appenders: {
            fileAll: { type: 'file', filename: `./storage/logs/${appName}.log`, layout: log4jsLayout.noColor },
            fileErrorBase: { type: 'file', filename: `./storage/logs/${appName}Error.log`, layout: log4jsLayout.noColor },
            fileError: { type: 'logLevelFilter', appender: 'fileErrorBase', level: 'error' },
            stdout: { type: 'stdout', layout: log4jsLayout.noColor },
        },
        categories: { default: { appenders: ['stdout', 'fileAll', 'fileError'], level: 'info'} },
    };

    const EMAIL_SERVICE = process.env.EMAIL_SERVICE ?? null;
    const EMAIL_USERNAME = process.env.EMAIL_USERNAME ?? null;
    const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD ?? null;

    const EMAIL_SENDER = process.env.EMAIL_SENDER ?? null;
    const EMAIL_RECIPIENTS = process.env.EMAIL_RECIPIENTS ?? null;

    let log4jsEmailConfigured = false;

    if(EMAIL_SERVICE !== null && EMAIL_USERNAME !== null && EMAIL_PASSWORD !== null && EMAIL_SENDER !== null && EMAIL_RECIPIENTS !== null) {
        log4jsEmailConfigured = true;

        const transportOptions = {
            service: EMAIL_SERVICE,
            auth: {
                user: EMAIL_USERNAME,
                pass: EMAIL_PASSWORD,
            }
        };

        log4jsConfig.appenders.email = {
            type: '@log4js-node/smtp',
            transport: {options: transportOptions},
            sender: EMAIL_SENDER,
            recipients: EMAIL_RECIPIENTS, // comma separated
            subject: `[${appName} (${this.env})] Error Mail`,
            layout: log4jsLayout.noColor,
            sendInterval: 0 // seconds
        };
        log4jsConfig.appenders.emailError = { type: 'logLevelFilter', appender: 'email', level: 'error' };
        log4jsConfig.categories.default.appenders.push('emailError');
    }

    const SLACK_TOKEN = process.env.SLACK_TOKEN ?? null;
    const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID ?? null;
    const SLACK_USERNAME = appName;

    let log4jsSlackConfigured = false;

    if(SLACK_TOKEN !== null && SLACK_CHANNEL_ID !== null) {
        log4jsSlackConfigured = true;

        log4jsConfig.appenders.slack = {
            type: '@log4js-node/slack',
            token: SLACK_TOKEN,
            channel_id: SLACK_CHANNEL_ID,
            username: SLACK_USERNAME,
            layout: log4jsLayout.noColor,
        }

        log4jsConfig.appenders.slackError = { type: 'logLevelFilter', appender: 'slack', level: 'error' };
        log4jsConfig.categories.default.appenders.push('slackError');
    }

    // note: type 'file' might fail to write if the app exits abruptly
    // aka if you use process.exit() or if the app crashes
    // you can use 'fileSync' but performance will be bad
    log4js.configure(log4jsConfig);

    this.logger = log4js.getLogger();

    this._buildData = function(eventName, eventData = {}, level) {
        const data = {
            time: DateTime.now().toISO(),
            logLevel: level,
            eventName: eventName,
        };

        const dataOther = {
            host: this.hostname,
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

    if(!log4jsEmailConfigured) {
        this.logger.warn("log4jsEmailNotConfigured");
    } else {
        this.logger.info("log4jsEmailConfigured", {
            "emailService": EMAIL_SERVICE,
            "emailUsername": EMAIL_USERNAME,
            "emailSender": EMAIL_SENDER,
            "emailRecipients": EMAIL_RECIPIENTS,
        });
    }

    if(!log4jsSlackConfigured) {
        this.logger.warn("log4jsSlackNotConfigured");
    }
}

export default Logger;
