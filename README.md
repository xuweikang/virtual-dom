# 虚拟DOM解析及其在框架里的应用

------
## 浏览器是怎样解析HTML并且绘出整个页面的
![webkit处理流程](https://upload-images.jianshu.io/upload_images/1959053-7c24fdb60936bd96.jpg?imageMogr2/auto-orient/strip%7CimageView2/2/w/636/format/webp)

上图为webkit引擎浏览器的处理流程，如上图大致分为4大步：<br />
第一步，HTML解析器分析html，构建一颗DOM树；<br />
第二步，CSS解析器会分析外联的css文件和内联的一些样式，创建一个页面的样式表；<br />
第三步，将DOM树和样式表关联起来，创建一颗Render树。这一过程又被称为Attachment，每个DOM节点上都有一个attach方法，会接收对应的样式表，返回一个render对象。这些render对象最终会结合成一个render tree；<br />
第四步，有了render tree后，浏览器就可以为render tree上的每个节点在屏幕上分配一个精确的位置坐标，然后各个节点会调用自身的paint方法结合坐标信息，在浏览器中绘制中整个页面了。<br />
## 回流（reflow）和重绘
回流和重绘都是浏览器自身的行为<br />
回流：当render tree中的一部分(或全部)因为元素的规模尺寸，布局，隐藏等改变而需要重新构建。这就称为回流(reflow)。每个页面至少需要一次回流，就是在页面第一次加载的时候。在回流的时候，浏览器会使渲染树中受到影响的部分失效，并重新构造这部分渲染树，完成回流后，浏览器会重新绘制受影响的部分到屏幕中，该过程成为重绘。<br />
重绘：当render tree中的一些元素需要更新属性，而这些属性只是影响元素的外观，风格，而不会影响布局的，比如background-color。则就叫称为重绘。<br />
减少回流的办法（不是这次讨论重点）：比如cssText、避免使用会强制reflush队列的属性等等
## 手动操作DOM带来的性能忧患
在使用原生的js api或者jquery等一些方法直接去操作dom的时候，可能会引起页面的reflow，而页面的回流所带来的代价是非常昂贵的。频繁的去操作dom，会引起页面的卡顿，影响用户的体验。
这里打印一个最简单的真实DOM节点里面的属性
![webkit处理流程](https://upload-images.jianshu.io/upload_images/1959053-409c2c86d78baa71.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1000/format/webp)
虚拟DOM就是为了解决频繁操作DOM的性能问题创造出来的。
例如：
如果使用原生api去操作一个会导致回流的DOM操作10次，那么浏览器会每次都会重新走一次上面的全流程，包括一些没变化的位置计算。
而虚拟DOM不会立即去操作DOM，而是将这10次更新的diff内容保存到本地的一个js对象中，最终将这个js对象一次性attach到DOM树上，通知浏览器去执行绘制工作，这样可以避免大量的无谓的计算量。
## virtual dom 是什么
这是一段真实的DOM tree结构
```
<div id="container">
    <p>Real DOM</p>
    <ul>
        <li class="item">Item 1</li>
        <li class="item">Item 2</li>
        <li class="item">Item 3</li>
    </ul>
</div>
```
如果用js对象来模拟上述的DOM Tree
```
let virtualDomTree = CreateElement('div', { id: 'container' }, [
    CreateElement('p', {}, ['Virtual DOM']),
    CreateElement('ul', {}, [
        CreateElement('li', { class: 'item' }, ['Item 1']),
        CreateElement('li', { class: 'item' }, ['Item 2']),
        CreateElement('li', { class: 'item' }, ['Item 3']),
    ]),
]);

let root = virtualDomTree.render();   //转换为一个真正的dom结构或者dom fragment
document.getElementById('virtualDom').appendChild(root);
```
这样的好处，避免了因直接去修改真实的dom而带来的性能隐患。可以先把页面的一些改动反应到这个虚拟dom对象上，等更新完后再一次统一去把变化同步到真实的dom中。<br />
下面是CreateElement的实现方法
```
function CreateElement(tagName, props, children) {
    if (!(this instanceof CreateElement)) {
        return new CreateElement(tagName, props, children);
    }

    this.tagName = tagName;
    this.props = props || {};
    this.children = children || [];
    this.key = props ? props.key : undefined;
}
```
render方法
```
CreateElement.prototype.render = function() {
    let el = document.createElement(this.tagName);
    let props = this.props;

    for (let propName in props) {
        setAttr(el, propName, props[propName]);
    }

    this.children.forEach((child) => {
        let childEl = (child instanceof Element) ? child.render() : document.createTextNode(child);
        el.appendChild(childEl);
    });

    return el;
};
```
直到现在，已经可以在页面中创建一个真实的DOM结构了。

## diff算法
上面已经完成了虚拟DOM -> 真实DOM的一个转换工作，现在只需要把页面上所有的改动都更新到虚拟DOM上。这就是一个diff过程。
>两棵树如果完全比较时间复杂度是O(n^3)，但参照《深入浅出React和Redux》一书中的介绍，React的Diff算法的时间复杂度是O(n)。要实现这么低的时间复杂度，意味着只能平层地比较两棵树的节点，放弃了深度遍历。这样做，似乎牺牲了一定的精确性来换取速度，但考虑到现实中前端页面通常也不会跨层级移动DOM元素，所以这样做是最优的。

只考虑相同等级diff，可以分为下面4中情况：<br />
第一种。如果节点类型变了，比如下面的p标签变成了h3标签，则直接卸载旧节点装载新节点，这个过程称为REPLACE。
![第一种情况](https://upload-images.jianshu.io/upload_images/1959053-fd068c191a95ea82.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1000/format/webp)

第二种情况。节点类型一样，仅仅是属性变化了，这一过程叫PROPS。比如
```
renderA: <ul>
renderB: <ul class: 'marginLeft10'>
=> [addAttribute class "marginLeft10"]
```
这一过程只会执行节点的更新操作，不会触发节点的卸载和装载操作。<br/>
第三种。只是文本变化了，TEXT过程。该过程只会替换文本。<br/>
第四种。节点发生了移动，增加，或者删除操作。该过程称为REOREDR。[虚拟DOM Diff算法解析](http://www.infoq.com/cn/articles/react-dom-diff)
![插入DOM-1](https://upload-images.jianshu.io/upload_images/1959053-b592d77d1cc244e1.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1000/format/webp)
如果在一些节点中间插入一个F节点，简单粗暴的做法是：卸载C，装载F，卸载D，装载C，卸载E，装载D，装载E。如下图：
![插入DOM-2](https://res.infoq.com/articles/react-dom-diff/zh/resources/0909005.png)<br />
这种方法显然是不高效的。<br/>
而如果给每个节点唯一的标识(key)，那么就能找到正确的位置去插入新的节点。
![插入DOM-3](https://res.infoq.com/articles/react-dom-diff/zh/resources/0909006.png)<br />
这也就是为什么vue/react等框架，会要求我们在写循环遍历结构的时候要写key值
## 在vue2.0中是如何使用虚拟dom来绑定和渲染模板的
![流程图1](https://img-blog.csdn.net/20180423112253119?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L0ZvcmV2ZXIyMDEyOTU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)<br />

1. 监听数据的变化
vue内部是通过数据劫持的方式来做到数据绑定的，其中最核心的方法就是通过Object.defineProperty()的getter和setter来实现对数据劫持，达到监听数据变动的目的。

2. vue中虚拟DOM生成DOM的过程
![流程图2](https://img-blog.csdn.net/20180423112303728?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L0ZvcmV2ZXIyMDEyOTU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)<br />

3. DocumentFragment和vue异步更新队列
[DocumentFragment](https://developer.mozilla.org/zh-CN/docs/Web/API/DocumentFragment)是容许把一些DOM操作先应用到一个dom片段里，然后再将这个片段append到DOM树里，从而来减少页面的reflow次数。
```
var fragment = document.createDocumentFragment();

//add DOM to fragment

for(var i = 0; i < 10; i++) {
    var spanNode = document.createElement("span");
    spanNode.innerHTML = "number:" + i;
    fragment.appendChild(spanNode);
}

//add this DOM to body
document.body.appendChild(spanNode);
```
vue里面的一些dom的一些变化，都是在DocumentFragment容器中去操作的，最后将这个更新片段append到el的根dom中。<br/>
走到这里，你会发现还有一个问题。就算vue使用了虚拟dom，将一些改动先同步到虚拟对象上，然后去改动真实DOM。这其中，去改动真实DOM还是使用了原生的api去操作DOM，还是会不可避免的去reflow整个页面，如果不能把这些更新操作打包起来集中去更新真实DOM，那其实完全散失了虚拟DOM的作用性，反而变得更加冗余。<br/>
这时候框架的价值就体现出来了，vue中，如果在同一次事件循环中如果观察到有多个数据变化，vue会开启一个[异步更新队列](https://cn.vuejs.org/v2/guide/reactivity.html)，并缓冲在同一事件循环中发生的所有数据改变。然后在下一个的事件循环‘tick’中，vue刷新队列并执行实际工作。这样就可以批量的去更新多次数据变化到虚拟dom对象中，diff差异，同步到页面中的真实dom里。
## 在react中是如何使用虚拟dom来绑定和渲染模板的


















