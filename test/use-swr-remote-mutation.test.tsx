import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { createKey, sleep } from './utils'

const waitForNextTick = () => act(() => sleep(1))

describe('useSWR - remote mutation', () => {
  it('should return data after triggering', async () => {
    const key = createKey()

    function Page() {
      const { data, trigger } = useSWRMutation(key, () => 'data')
      return <button onClick={() => trigger()}>{data || 'pending'}</button>
    }

    render(<Page />)

    // mount
    await screen.findByText('pending')

    fireEvent.click(screen.getByText('pending'))
    await waitForNextTick()

    screen.getByText('data')
  })

  it('should trigger request with correct args', async () => {
    const key = createKey()
    const fetcher = jest.fn(() => 'data')

    function Page() {
      const { data, trigger } = useSWRMutation([key, 'arg0'], fetcher)
      return (
        <button onClick={() => trigger('arg1')}>{data || 'pending'}</button>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('pending')
    expect(fetcher).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('pending'))
    await waitForNextTick()

    screen.getByText('data')

    expect(fetcher).toHaveBeenCalled()
    expect(fetcher.mock.calls.length).toBe(1)
    expect(fetcher.mock.calls[0]).toEqual([key, 'arg0', 'arg1'])
  })

  it('should call `onSuccess` event', async () => {
    const key = createKey()
    const onSuccess = jest.fn()

    function Page() {
      const { data, trigger } = useSWRMutation(key, () => 'data', {
        onSuccess
      })
      return <button onClick={() => trigger()}>{data || 'pending'}</button>
    }

    render(<Page />)

    // mount
    await screen.findByText('pending')

    fireEvent.click(screen.getByText('pending'))
    await waitForNextTick()

    screen.getByText('data')

    expect(onSuccess).toHaveBeenCalled()
  })

  it('should call `onError` event', async () => {
    const key = createKey()
    const onError = jest.fn()
    const onInplaceError = jest.fn()

    function Page() {
      const { data, error, trigger } = useSWRMutation(
        key,
        async () => {
          await sleep(10)
          throw new Error('error!')
        },
        {
          onError
        }
      )
      return (
        <button onClick={() => trigger().catch(onInplaceError)}>
          {data || (error ? error.message : 'pending')}
        </button>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('pending')
    fireEvent.click(screen.getByText('pending'))

    await screen.findByText('error!')
    expect(onError).toHaveBeenCalled()
    expect(onInplaceError).toHaveBeenCalled()
  })

  it('should return `isMutating` state correctly', async () => {
    const key = createKey()

    function Page() {
      const { data, trigger, isMutating } = useSWRMutation(key, async () => {
        await sleep(10)
        return 'data'
      })
      return (
        <button onClick={trigger}>
          state:{(isMutating ? 'pending' : data) || ''}
        </button>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('state:')
    fireEvent.click(screen.getByText('state:'))

    await screen.findByText('state:pending')
    await screen.findByText('state:data')
  })

  it('should send `onError` and `onSuccess` events', async () => {
    const key = createKey()
    const onSuccess = jest.fn()
    const onError = jest.fn()

    let arg = false

    function Page() {
      const { data, error, trigger } = useSWRMutation(
        key,
        async (_, shouldReturnValue) => {
          await sleep(10)
          if (shouldReturnValue) return 'data'
          throw new Error('error')
        },
        {
          onSuccess,
          onError
        }
      )
      return (
        <button onClick={() => trigger(arg).catch(() => {})}>
          {data || (error ? error.message : 'pending')}
        </button>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('pending')
    fireEvent.click(screen.getByText('pending'))

    await screen.findByText('error')
    expect(onError).toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()

    arg = true
    fireEvent.click(screen.getByText('error'))
    await screen.findByText('data')
    expect(onSuccess).toHaveBeenCalled()
  })

  it('should not dedupe trigger requests', async () => {
    const key = createKey()
    const fn = jest.fn()

    function Page() {
      const { trigger } = useSWRMutation(key, async () => {
        fn()
        await sleep(10)
        return 'data'
      })
      return <button onClick={trigger}>trigger</button>
    }

    render(<Page />)

    // mount
    await screen.findByText('trigger')
    expect(fn).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('trigger'))
    expect(fn).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('trigger'))
    fireEvent.click(screen.getByText('trigger'))
    fireEvent.click(screen.getByText('trigger'))
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('should share the cache with `useSWR` when `populateCache` is enabled', async () => {
    const key = createKey()

    function Page() {
      const { data } = useSWR(key)
      const { trigger } = useSWRMutation(key, async () => {
        await sleep(10)
        return 'data'
      })
      return (
        <div>
          <button onClick={() => trigger(undefined, { populateCache: true })}>
            trigger
          </button>
          <div>data:{data || 'none'}</div>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')

    fireEvent.click(screen.getByText('trigger'))
    await screen.findByText('data:data')
  })

  it('should not read the cache from `useSWR`', async () => {
    const key = createKey()

    function Page() {
      useSWR(key, () => 'data')
      const { data } = useSWRMutation(key, () => 'wrong!')
      return <div>data:{data || 'none'}</div>
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')
  })

  it('should be able to populate the cache for `useSWR`', async () => {
    const key = createKey()

    function Page() {
      const { data } = useSWR(key, () => 'data')
      const { trigger } = useSWRMutation(key, (_, arg) => arg)
      return (
        <div onClick={() => trigger('updated!', { populateCache: true })}>
          data:{data || 'none'}
        </div>
      )
    }

    render(<Page />)

    await screen.findByText('data:none')

    // mount
    await screen.findByText('data:data')

    // mutate
    fireEvent.click(screen.getByText('data:data'))
    await screen.findByText('data:updated!')
  })

  it('should not trigger request when mutating', async () => {
    const key = createKey()
    const fn = jest.fn(() => 'data')

    function Page() {
      const { mutate } = useSWRMutation(key, fn)
      return (
        <div>
          <button onClick={() => mutate()}>mutate</button>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('mutate')

    fireEvent.click(screen.getByText('mutate'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('should not trigger request when mutating from shared hooks', async () => {
    const key = createKey()
    const fn = jest.fn(() => 'data')

    function Page() {
      useSWRMutation(key, fn)
      const { mutate } = useSWR(key)
      return (
        <div>
          <button onClick={() => mutate()}>mutate</button>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('mutate')

    fireEvent.click(screen.getByText('mutate'))

    await act(() => sleep(50))
    expect(fn).not.toHaveBeenCalled()
  })

  it('should not trigger request when key changes', async () => {
    const key = createKey()
    const fn = jest.fn(() => 'data')

    function Page() {
      const [k, setK] = React.useState(key)
      useSWRMutation(k, fn)
      return (
        <div>
          <button onClick={() => setK(key + '_new')}>update key</button>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('update key')

    fireEvent.click(screen.getByText('update key'))

    await act(() => sleep(50))
    expect(fn).not.toHaveBeenCalled()
  })

  it('should prevent race conditions with `useSWR`', async () => {
    const key = createKey()
    const logger = jest.fn()

    function Page() {
      const { data } = useSWR(key, async () => {
        await sleep(10)
        return 'foo'
      })
      const { trigger } = useSWRMutation(key, async () => {
        await sleep(20)
        return 'bar'
      })

      logger(data)

      return (
        <div>
          <button
            onClick={() =>
              trigger(undefined, { revalidate: false, populateCache: true })
            }
          >
            trigger
          </button>
          <div>data:{data || 'none'}</div>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')

    fireEvent.click(screen.getByText('trigger'))
    await act(() => sleep(50))
    await screen.findByText('data:bar')

    // It should never render `foo`.
    expect(logger).not.toHaveBeenCalledWith('foo')
  })

  it('should revalidate after mutating by default', async () => {
    const key = createKey()
    const logger = jest.fn()

    function Page() {
      const { data } = useSWR(
        key,
        async () => {
          await sleep(10)
          return 'foo'
        },
        { revalidateOnMount: false }
      )
      const { trigger } = useSWRMutation(key, async () => {
        await sleep(20)
        return 'bar'
      })

      logger(data)

      return (
        <div>
          <button onClick={() => trigger(undefined)}>trigger</button>
          <div>data:{data || 'none'}</div>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')

    fireEvent.click(screen.getByText('trigger'))
    await act(() => sleep(50))

    // It triggers revalidation
    await screen.findByText('data:foo')

    // It should never render `bar` since we never populate the cache.
    expect(logger).not.toHaveBeenCalledWith('bar')
  })

  it('should revalidate after populating the cache', async () => {
    const key = createKey()
    const logger = jest.fn()

    function Page() {
      const { data } = useSWR(
        key,
        async () => {
          await sleep(20)
          return 'foo'
        },
        { revalidateOnMount: false }
      )
      const { trigger } = useSWRMutation(key, async () => {
        await sleep(20)
        return 'bar'
      })

      logger(data)

      return (
        <div>
          <button onClick={() => trigger(undefined, { populateCache: true })}>
            trigger
          </button>
          <div>data:{data || 'none'}</div>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')

    fireEvent.click(screen.getByText('trigger'))

    // Cache is updated
    await screen.findByText('data:bar')

    // A revalidation is triggered
    await screen.findByText('data:foo')
  })

  it('should be able to reset the state', async () => {
    const key = createKey()

    function Page() {
      const { data, trigger, reset } = useSWRMutation(key, async () => {
        return 'data'
      })

      return (
        <div>
          <button onClick={trigger}>trigger</button>
          <button onClick={reset}>reset</button>
          <div>data:{data || 'none'}</div>
        </div>
      )
    }

    render(<Page />)

    // mount
    await screen.findByText('data:none')

    fireEvent.click(screen.getByText('trigger'))

    // Cache is updated
    await screen.findByText('data:data')

    // reset
    fireEvent.click(screen.getByText('reset'))
    await screen.findByText('data:none')
  })
})