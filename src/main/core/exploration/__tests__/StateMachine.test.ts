import { StateMachine } from '../StateMachine';
jest.mock('../../logger/Logger');

describe('AI Exploration StateMachine', () => {
  let machine: StateMachine;
  beforeEach(() => {
    machine = new StateMachine();
    // Suppress unhandled error events
    machine.on('error', () => {});
  });

  it('初始状态应为 IDLE', () => expect(machine.getCurrentState()).toBe('IDLE'));

  it('正常生命周期流转', () => {
    machine.transition('INIT'); expect(machine.getCurrentState()).toBe('INIT');
    machine.transition('EXPLORING'); machine.transition('COMPARING');
    machine.transition('GENERATING'); machine.transition('DONE');
  });

  it('非法路径拦截', () => {
    expect(() => machine.transition('EXPLORING')).toThrow('Invalid state transition');
  });

  it('任何状态可降级到 ERROR', () => {
    machine.transition('INIT'); machine.transition('EXPLORING');
    machine.transition('ERROR'); expect(machine.getCurrentState()).toBe('ERROR');
  });

  it('触发 stateChange 事件', () => {
    const listener = jest.fn(); machine.on('stateChange', listener);
    machine.transition('INIT');
    expect(listener).toHaveBeenCalledWith({ from: 'IDLE', to: 'INIT' });
  });
});
