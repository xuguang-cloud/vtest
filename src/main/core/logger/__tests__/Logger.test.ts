import { Logger } from '../Logger';

describe('Logger', () => {
  describe('getLogger', () => {
    it('should return same instance for same name', () => {
      const logger1 = Logger.getLogger('test');
      const logger2 = Logger.getLogger('test');
      expect(logger1).toBe(logger2);
    });

    it('should return different instances for different names', () => {
      const logger1 = Logger.getLogger('test1');
      const logger2 = Logger.getLogger('test2');
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('log levels', () => {
    it('should log debug when level is debug', () => {
      const logger = Logger.getLogger('debug-test');
      logger.setLevel('debug');
      expect(() => logger.debug('test')).not.toThrow();
    });

    it('should not log debug when level is info', () => {
      const logger = Logger.getLogger('info-test');
      logger.setLevel('info');
      expect(() => logger.debug('test')).not.toThrow();
    });

    it('should log info message', () => {
      const logger = Logger.getLogger('info-log');
      expect(() => logger.info('info message')).not.toThrow();
    });

    it('should log warn message', () => {
      const logger = Logger.getLogger('warn-log');
      expect(() => logger.warn('warn message')).not.toThrow();
    });

    it('should log error message', () => {
      const logger = Logger.getLogger('error-log');
      expect(() => logger.error('error message')).not.toThrow();
    });

    it('should log fatal message', () => {
      const logger = Logger.getLogger('fatal-log');
      expect(() => logger.fatal('fatal message')).not.toThrow();
    });
  });

  describe('setLevel', () => {
    it('should set log level', () => {
      const logger = Logger.getLogger('level-test');
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('getLevel', () => {
    it('should return default level as info', () => {
      const logger = Logger.getLogger('default-level');
      expect(logger.getLevel()).toBe('info');
    });
  });
});
