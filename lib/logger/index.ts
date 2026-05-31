// Simple logger that matches pino-like API
export const logger = {
  info: (msg: any, ...args: any[]) => console.log(msg, ...args),
  error: (msg: any, ...args: any[]) => console.error(msg, ...args),
  warn: (msg: any, ...args: any[]) => console.warn(msg, ...args),
  debug: (msg: any, ...args: any[]) => console.debug(msg, ...args),
  log: (msg: any, ...args: any[]) => console.log(msg, ...args),
  child: (bindings: any) => logger, // Return self for child logger compatibility
};
