/**
 * Observer Pattern for Repository State Changes
 * Allows multiple windows to subscribe to repository updates
 */

export interface IStateObserver<T> {
  onStateChanged(state: T): void;
}

export interface IObservable<T> {
  subscribe(observer: IStateObserver<T>): void;
  unsubscribe(observer: IStateObserver<T>): void;
  notifyObservers(state: T): void;
}

export abstract class BaseObservable<T> implements IObservable<T> {
  protected observers: Set<IStateObserver<T>> = new Set();

  subscribe(observer: IStateObserver<T>): void {
    this.observers.add(observer);
  }

  unsubscribe(observer: IStateObserver<T>): void {
    this.observers.delete(observer);
  }

  notifyObservers(state: T): void {
    for (const observer of this.observers) {
      try {
        observer.onStateChanged(state);
      } catch (err) {
        console.error('[Observer] Error notifying observer:', err);
      }
    }
  }
}
