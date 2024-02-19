import { DateTime } from 'luxon';
import log4js from 'log4js';
import os from 'os';
import path from 'path';

function Logger(appName) {
    this.hostname = os.hostname();
    this.source = appName;
    this.env = process.env.ENV ?? 'unknown';
    this.ver = process.env.VER ?? 'unknown';
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL ?? null;

    // https://github.com/log4js-node/log4js-node/blob/master/docs/layouts.md
    // will also write the color escape sequence to file, so better avoid it
    const log4jsLayout = {
        noColor: { type: 'messagePassThrough' },
        colored: {
            type: 'pattern',
            pattern: '%[%m%]'
        },
    };

    const logBaseDir = './storage/logs';
    const infoLogPath = path.join(logBaseDir, `${appName}.log`);
    const errorLogPath = path.join(logBaseDir, `${appName}Error.log`);

    // note: type 'file' might fail to write if the app exits abruptly
    // aka if you use process.exit() or if the app crashes
    // you can use 'fileSync' but performance will be bad
    const log4jsConfig = {
        appenders: {
            fileAll: { type: 'file', filename: infoLogPath, layout: log4jsLayout.noColor },
            fileErrorBase: { type: 'file', filename: errorLogPath, layout: log4jsLayout.noColor },
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

    this.info = function (eventName, eventData = {}, isImportant = false) {
        const data = this._buildData(eventName, eventData, "info");
        const dataStr = JSON.stringify(data);
        this.logger.info(dataStr);
        if(isImportant) {
            this.sendMessageToSlack(dataStr);
        }
    }

    this.infoImportant = function (eventName, eventData = {}) {
        this.info(eventName, eventData, true);
    }

    this.sendMessageToSlack = async function (message) {
        if(this.slackWebhookUrl === null) {
            return;
        }

        try {
            const response = await fetch(this.slackWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: message }),
            });
            console.log(response);
        } catch (e) {
            this.warn("sendMessageToSlackError", { error: e.toString() });
        }

        //return response;
    }

    this.warn = function(eventName, eventData = {}) {
        const data = this._buildData(eventName, eventData, "warn");
        this.logger.warn(JSON.stringify(data));
    }

    this.error = function(eventName, eventData = {}) {
        const data = this._buildData(eventName, eventData, "error");
        this.logger.error(JSON.stringify(data));
    }

    this.info("loggerInit", {
        "infoLogPath": infoLogPath,
        "errorLogPath": errorLogPath,
    });

    if(!log4jsEmailConfigured) {
        this.warn("log4jsEmailNotConfigured", {
            "emailService": EMAIL_SERVICE,
            "emailUsername": EMAIL_USERNAME,
            "emailPasswordIsNull": EMAIL_PASSWORD === null,
            "emailSender": EMAIL_SENDER,
            "emailRecipients": EMAIL_RECIPIENTS,
        });
    } else {
        this.info("log4jsEmailConfigured", {
            "emailService": EMAIL_SERVICE,
            "emailUsername": EMAIL_USERNAME,
            "emailSender": EMAIL_SENDER,
            "emailRecipients": EMAIL_RECIPIENTS,
        });
    }

    if(!log4jsSlackConfigured) {
        this.warn("log4jsSlackNotConfigured", {
            "slackTokenIsNull": SLACK_TOKEN === null,
            "slackChannelId": SLACK_CHANNEL_ID,
            "slackUsername": SLACK_USERNAME,
        });
    } else {
        this.info("log4jsSlackConfigured", {
            "slackChannelId": SLACK_CHANNEL_ID,
            "slackUsername": SLACK_USERNAME,
        });
    }

    if(this.slackWebhookUrl === null) {
        this.warn("slackWebhookUrlNotConfigured");
    }
}

export default Logger;
