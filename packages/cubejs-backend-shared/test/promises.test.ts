import {
  createCancelablePromise,
  createCancelableInterval,
  pausePromise,
  retryWithTimeout,
  withTimeout,
  withTimeoutRace,
  asyncMemoize, asyncRetry, asyncDebounce,
} from '../src';

test('createCancelablePromise', async () => {
  let canceled = false;

  const promise = createCancelablePromise(async (token) => {
    await pausePromise(250);

    if (token.isCanceled()) {
      canceled = true;

      return;
    }

    await pausePromise(250);
  });
  await promise.cancel();

  await pausePromise(250);

  expect(canceled).toBe(true);
});

test('createCancelablePromise(defer async)', async () => {
  let finished = false;
  let canceled = false;

  const promise = createCancelablePromise(async (token) => {
    token.defer(async () => {
      canceled = true;
    });

    await pausePromise(250);

    finished = true;
  });
  await promise.cancel();

  expect(canceled).toBe(true);
  expect(finished).toBe(true);
});

test('createCancelablePromise(defer async + with)', async () => {
  let finished = false;
  let canceled = false;

  const promise = createCancelablePromise(async (token) => {
    token.defer(async () => {
      canceled = true;
    });

    // This pause promise will be canceled by resolving
    token.with(pausePromise(25 * 1000));

    finished = true;
  });
  await promise.cancel();

  expect(canceled).toBe(true);
  expect(finished).toBe(true);
});

describe('createCancelableInterval', () => {
  test('handle too fast execution', async () => {
    let started = 0;
    let finished = 0;
    let onDuplicatedExecution = 0;
    let onDuplicatedStateResolved = 0;

    const interval = createCancelableInterval(async (token) => {
      started++;

      await pausePromise(100);

      finished++;
    }, {
      interval: 50,
      onDuplicatedExecution: (intervalId) => {
        expect(Number.isInteger(intervalId)).toBeTruthy();

        onDuplicatedExecution++;
      },
      onDuplicatedStateResolved: (intervalId, elapsed) => {
        expect(Number.isInteger(intervalId)).toBeTruthy();
        expect(elapsed).toBeGreaterThanOrEqual(50 - 5);

        onDuplicatedStateResolved++;
      }
    });

    /**
     * Interval is 50, when execution is 100
     * Let's wait 5 intervals, which will do 2 executions
     */
    await pausePromise(50 * 5 + 25);
    await interval.cancel(true);

    expect(started).toBeGreaterThanOrEqual(2);
    expect(finished).toEqual(started);

    expect(onDuplicatedExecution).toBeGreaterThanOrEqual(2);
    expect(onDuplicatedStateResolved).toBeGreaterThanOrEqual(2);
  });

  test('simple interval', async () => {
    let started = 0;
    let finished = 0;
    let onDuplicatedExecution = 0;
    let onDuplicatedStateResolved = 0;
    let canceled = false;

    const interval = createCancelableInterval(async (token) => {
      started++;

      await pausePromise(25);

      if (token.isCanceled()) {
        // console.log('canceling');

        canceled = true;

        return;
      }

      await pausePromise(25);

      finished++;
    }, {
      interval: 100,
      onDuplicatedExecution: () => {
        onDuplicatedExecution++;
      },
      onDuplicatedStateResolved: () => {
        onDuplicatedStateResolved++;
      }
    });

    await pausePromise(100 + 25 + 25 + 10);

    expect(started).toEqual(1);
    expect(finished).toEqual(1);

    await pausePromise(50);

    await interval.cancel(true);

    expect(canceled).toEqual(true);
    expect(started).toEqual(2);
    expect(finished).toEqual(1);

    // Interval 100ms, when execution takes ~50ms
    expect(onDuplicatedExecution).toEqual(0);
    expect(onDuplicatedStateResolved).toEqual(0);
  });

  test('cancel should wait latest execution', async () => {
    let started = 0;
    let finished = 0;

    const interval = createCancelableInterval(async (token) => {
      started++;

      await pausePromise(250);

      finished++;
    }, {
      interval: 100,
    });

    await pausePromise(100);

    await interval.cancel();

    expect(started).toEqual(1);
    expect(finished).toEqual(1);
  });
});

test('withTimeoutRace(ok)', async () => {
  let canceled = false;

  const result = await withTimeoutRace(
    createCancelablePromise(async (token) => {
      token.defer(async () => {
        canceled = true;
      });

      return 256;
    }),
    250
  );

  expect(result).toEqual(256);
  expect(canceled).toEqual(false);
});

test('withTimeoutRace(timeout)', async () => {
  let started = false;
  let canceled = false;
  let finished = false;

  try {
    await withTimeoutRace(
      createCancelablePromise(async (token) => {
        started = true;

        token.defer(async () => {
          canceled = true;
        });

        await pausePromise(1000);

        finished = true;
      }),
      250
    );

    throw new Error('Unexpected');
  } catch (e) {
    expect(e.message).toEqual('Timeout reached after 250ms');
  }

  expect(started).toEqual(true);
  expect(canceled).toEqual(true);
  expect(finished).toEqual(false);
});

test('withTimeout(fired)', async () => {
  let cbFired = false;
  let isFulfilled = false;

  const promise = withTimeout(
    async (token) => {
      cbFired = true;
    },
    50
  );
  promise.then(
    (v) => {
      isFulfilled = true;
    },
  );

  await pausePromise(100);

  expect(isFulfilled).toEqual(true);
  expect(cbFired).toEqual(true);
});

test('withTimeout(cancellation)', async () => {
  let cbFired = false;
  let isFulfilled = false;
  let isPending = true;
  let isRejected = false;

  const promise = withTimeout(
    async (token) => {
      cbFired = true;
    },
    1000
  );
  promise.then(
    (v) => {
      isFulfilled = true;
      isPending = false;
      return v;
    },
    () => {
      isRejected = true;
      isPending = false;
    },
  );

  expect(isPending).toEqual(true);

  await promise.cancel();

  expect(isFulfilled).toEqual(true);
  expect(isPending).toEqual(false);
  expect(isRejected).toEqual(false);
  expect(cbFired).toEqual(false);
});

test('retryWithTimeout', async () => {
  let iterations = 0;

  const result = await retryWithTimeout(
    async (token) => {
      iterations++;

      if (iterations === 10) {
        return 256;
      }

      return null;
    },
    { timeout: 1000, intervalPause: () => 10 }
  );

  expect(result).toEqual(256);
  expect(iterations).toEqual(10);
});

describe('asyncMemoize', () => {
  test('asyncMemoize cache', async () => {
    let called = 0;

    const memCall = await asyncMemoize(
      async (url: string) => {
        called++;

        return Math.random();
      },
      {
        extractCacheLifetime: () => 1 * 500,
        extractKey: (url) => url,
      }
    );

    const firstCallRandomValue = await memCall('test');

    expect(called).toEqual(1);

    expect(await memCall('test')).toEqual(firstCallRandomValue);
    expect(await memCall('test')).toEqual(firstCallRandomValue);

    expect(called).toEqual(1);

    await memCall('anotherValue');

    expect(called).toEqual(2);

    await pausePromise(800);

    expect(await memCall('test') !== firstCallRandomValue).toEqual(true);

    expect(called).toEqual(3);
  });

  test('asyncMemoize force', async () => {
    let called = 0;

    const memCall = await asyncMemoize(
      async (url: string) => {
        called++;

        return Math.random();
      },
      {
        extractCacheLifetime: () => 1 * 500,
        extractKey: (url) => url,
      }
    );

    const firstCallRandomValue = await memCall('test');

    expect(called).toEqual(1);

    expect(await memCall('test')).toEqual(firstCallRandomValue);
    expect(await memCall('test')).toEqual(firstCallRandomValue);

    expect(called).toEqual(1);

    const secondCallRandomValue = await memCall.force('test');

    expect(secondCallRandomValue !== firstCallRandomValue).toEqual(true);

    expect(called).toEqual(2);

    expect(await memCall('test')).toEqual(secondCallRandomValue);
    expect(await memCall('test')).toEqual(secondCallRandomValue);

    expect(called).toEqual(2);
  });
});

describe('asyncRetry', () => {
  test('without exception', async () => {
    let called = 0;

    const result = await asyncRetry(
      async () => {
        called++;

        return 5555;
      },
      {
        times: 3,
      }
    );

    expect(called).toEqual(1);
    expect(result).toEqual(5555);
  });

  test('once time exception', async () => {
    let called = 0;
    let exception = false;

    const result = await asyncRetry(
      async () => {
        called++;

        if (!exception) {
          exception = true;

          throw new Error('test');
        }

        return 555;
      },
      {
        times: 3,
      }
    );

    expect(called).toEqual(2);
    expect(result).toEqual(555);
  });

  test('all time exception', async () => {
    let called = 0;

    try {
      await asyncRetry(
        async () => {
          called++;

          throw new Error('test');
        },
        {
          times: 3,
        }
      );

      throw new Error('should throw exception');
    } catch (e) {
      expect(e.message).toEqual('test');
      expect(called).toEqual(3);
    }
  });
});

describe('asyncDebounce', () => {
  test('multiple async calls to single', async () => {
    let called = 0;

    const doOnce = asyncDebounce(
      async (arg1: string, arg2: string) => {
        called++;

        expect(arg1).toEqual('arg1');
        expect(arg2).toEqual('arg2');

        await pausePromise(200);

        return Math.random();
      }
    );

    const [first, second, third] = await Promise.all([
      doOnce('arg1', 'arg2'),
      doOnce('arg1', 'arg2'),
      doOnce('arg1', 'arg2'),
    ]);

    expect(called).toEqual(1);
    expect(first === second).toEqual(true);
    expect(second === third).toEqual(true);

    await pausePromise(200 + 25);

    await doOnce('arg1', 'arg2');
    expect(called).toEqual(2);
  });
});
