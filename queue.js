import config from './config'
import {
    warn,
    nextTick,
    devtools
} from './util/index'

// we have two separate queues: one for directive updates
// and one for user watcher registered via $watch().
// we want to guarantee directive updates to be called
// before user watchers so that when user watchers are
// triggered, the DOM would have already been in updated
// state.

var queue = [] //这个应该用于指令异步更新的队列
var userQueue = [] //这个应该是用于用户定义的data异步更新的队列
var has = {}
var circular = {}
var waiting = false

/**
 * Reset the batcher's state.
 */
// 重置队列状态
function resetBatcherState () {
    queue.length = 0
    userQueue.length = 0
    has = {}
    circular = {}
    waiting = false
}

/**
 * Flush both queues and run the watchers.
 */
//执行这2个队列里的异步更新
function flushBatcherQueue () {
    runBatcherQueue(queue)
    runBatcherQueue(userQueue)
    // user watchers triggered more watchers,
    // keep flushing until it depletes
    if (queue.length) { //如果执行的时候又有异步更新被查到队列中，就继续执行
        return flushBatcherQueue()
    }
    // dev tool hook
    /* istanbul ignore if */
    if (devtools && config.devtools) {
        devtools.emit('flush')
    }
    resetBatcherState() 执行完后重置异步更新队列
}

/**
 * Run the watchers in a single queue.
 *
 * @param {Array} queue
 */
//这里就是循环更新异步队列中的watcher
function runBatcherQueue (queue) {
    // do not cache length because more watchers might be pushed
    // as we run existing watchers
    for (let i = 0; i < queue.length; i++) {
        var watcher = queue[i]
        var id = watcher.id
        has[id] = null
        watcher.run()
        // in dev build, check and stop circular updates.
        if (process.env.NODE_ENV !== 'production' && has[id] != null) {
            circular[id] = (circular[id] || 0) + 1
            if (circular[id] > config._maxUpdateCount) {
                warn(
                    'You may have an infinite update loop for watcher ' +
                    'with expression "' + watcher.expression + '"',
                    watcher.vm
                )
                break
            }
        }
    }
    queue.length = 0
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * @param {Watcher} watcher
 *   properties:
 *   - {Number} id
 *   - {Function} run
 */
//这个开放的接口，把需要更新的watcher添加到异步队列中
export function pushWatcher (watcher) {
    const id = watcher.id
    if (has[id] == null) {
        // push watcher into appropriate queue
        const q = watcher.user
            ? userQueue
            : queue
        has[id] = q.length
        q.push(watcher)
        // queue the flush
        if (!waiting) {
            waiting = true
            nextTick(flushBatcherQueue)
        }
    }
}
