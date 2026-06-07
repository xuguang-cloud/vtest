import { StateMachine, ExplorationState } from '../StateMachine';
jest.mock('../../logger/Logger');

describe('AI Exploration StateMachine', () => {
  let machine: StateMachine;
  beforeEach(() => machine = new StateMachine());

  it('初始状态应为 IDLE', () => expect(machine.getCurrentState()).toBe(ExplorationState.IDLE));

  it('正常生命周期流转', () => {
    machine.transition(ExplorationState.INIT); expect(machine.getCurrentState()).toBe(ExplorationState.INIT);
    machine.transition(ExplorationState.EXPLORING); machine.transition(ExplorationState.COMPARING);
    machine.transition(ExplorationState.GENERATING); machine.transition(ExplorationState.DONE);
  });

  it('非法路径拦截', () => {
    expect(() => machine.transition(ExplorationState.EXPLORING)).toThrow('Invalid state transition');
  });

  it('任何状态可降级到 ERROR', () => {
    machine.transition(ExplorationState.INIT); machine.transition(ExplorationState.EXPLORING);
    machine.transition(ExplorationState.ERROR); expect(machine.getCurrentState()).toBe(ExplorationState.ERROR);
  });

  it('触发 stateChange 事件', () => {
    const listener = jest.fn(); machine.on('stateChange', listener);
    machine.transition(ExplorationState.INIT);
    expect(listener).toHaveBeenCalledWith({ from: ExplorationState.IDLE, to: ExplorationState.INIT });
  });
});