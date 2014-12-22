m.module({
    name : "polyfills",

    initialize: function() {
        //console.log( this.name + ": initialize" );
        this.install();
    },

    install: function( ) {
        //console.log( this.name + ": install" );
        this.installPolyfill_document_currentScript();
        this.installPolyfill_promise();
    },

    /*! Native Promise Only
      v0.7.6-a (c) Kyle Simpson
      MIT License: http://getify.mit-license.org
    */
    installPolyfill_promise : function() {
        console.log("installing promise polyfill...");
        (function installIt(name,definition){
            // Context ends up being where the polyfill gets installed.
            // Tested in Firefox, Chrome, and android browser.
            var context =
                typeof global != "undefined" ? global :
                typeof window != "undefined" ? window :
                this;

            // Install the polyfill...
            context[name] = context[name] || definition();
        })("Promise",function DEF(){
            /*jshint validthis:true */
            "use strict";

            var builtInProp, cycle, scheduling_queue,
                ToString = Object.prototype.toString,
                timer = (typeof setImmediate != "undefined") ?
                function timer(fn) { return setImmediate(fn); } :
                setTimeout
            ;

            // damnit, IE8.
            try {
                Object.defineProperty({},"x",{});
                builtInProp = function builtInProp(obj,name,val,config) {
                    return Object.defineProperty(obj,name,{
                        value: val,
                        writable: true,
                        configurable: config !== false
                    });
                };
            }
            catch (err) {
                builtInProp = function builtInProp(obj,name,val) {
                    obj[name] = val;
                    return obj;
                };
            }

            // Note: using a queue instead of array for efficiency
            scheduling_queue = (function Queue() {
                var first, last, item;

                function Item(fn,self) {
                    this.fn = fn;
                    this.self = self;
                    this.next = void 0;
                }

                return {
                    add: function add(fn,self) {
                        item = new Item(fn,self);
                        if (last) {
                            last.next = item;
                        }
                        else {
                            first = item;
                        }
                        last = item;
                        item = void 0;
                    },
                    drain: function drain() {
                        var f = first;
                        first = last = cycle = void 0;

                        while (f) {
                            f.fn.call(f.self);
                            f = f.next;
                        }
                    }
                };
            })();

            function schedule(fn,self) {
                scheduling_queue.add(fn,self);
                if (!cycle) {
                    cycle = timer(scheduling_queue.drain);
                }
            }

            // promise duck typing
            function isThenable(o) {
                var _then, o_type = typeof o;

                if (o != null &&
                    (
                        o_type == "object" || o_type == "function"
                    )
                   ) {
                    _then = o.then;
                }
                return typeof _then == "function" ? _then : false;
            }

            function notify() {
                for (var i=0; i<this.chain.length; i++) {
                    notifyIsolated(
                        this,
                        (this.state === 1) ? this.chain[i].success : this.chain[i].failure,
                        this.chain[i]
                    );
                }
                this.chain.length = 0;
            }

            // NOTE: This is a separate function to isolate
            // the `try..catch` so that other code can be
            // optimized better
            function notifyIsolated(self,cb,chain) {
                var ret, _then;
                try {
                    if (cb === false) {
                        chain.reject(self.msg);
                    }
                    else {
                        if (cb === true) {
                            ret = self.msg;
                        }
                        else {
                            ret = cb.call(void 0,self.msg);
                        }

                        if (ret === chain.promise) {
                            chain.reject(TypeError("Promise-chain cycle"));
                        }
                        else if (_then = isThenable(ret)) {
                            _then.call(ret,chain.resolve,chain.reject);
                        }
                        else {
                            chain.resolve(ret);
                        }
                    }
                }
                catch (err) {
                    chain.reject(err);
                }
            }

            function resolve(msg) {
                var _then, def_wrapper, self = this;

                // already triggered?
                if (self.triggered) { return; }

                self.triggered = true;

                // unwrap
                if (self.def) {
                    self = self.def;
                }

                try {
                    if (_then = isThenable(msg)) {
                        def_wrapper = new MakeDefWrapper(self);
                        _then.call(msg,
                                   function $resolve$(){ resolve.apply(def_wrapper,arguments); },
                                   function $reject$(){ reject.apply(def_wrapper,arguments); }
                                  );
                    }
                    else {
                        self.msg = msg;
                        self.state = 1;
                        if (self.chain.length > 0) {
                            schedule(notify,self);
                        }
                    }
                }
                catch (err) {
                    reject.call(def_wrapper || (new MakeDefWrapper(self)),err);
                }
            }

            function reject(msg) {
                var self = this;

                // already triggered?
                if (self.triggered) { return; }

                self.triggered = true;

                // unwrap
                if (self.def) {
                    self = self.def;
                }

                self.msg = msg;
                self.state = 2;
                if (self.chain.length > 0) {
                    schedule(notify,self);
                }
            }

            function iteratePromises(Constructor,arr,resolver,rejecter) {
                for (var idx=0; idx<arr.length; idx++) {
                    (function IIFE(idx){
                        Constructor.resolve(arr[idx])
                            .then(
                                function $resolver$(msg){
                                    resolver(idx,msg);
                                },
                                rejecter
                            );
                    })(idx);
                }
            }

            function MakeDefWrapper(self) {
                this.def = self;
                this.triggered = false;
            }

            function MakeDef(self) {
                this.promise = self;
                this.state = 0;
                this.triggered = false;
                this.chain = [];
                this.msg = void 0;
            }

            function Promise(executor) {
                if (typeof executor != "function") {
                    throw TypeError("Not a function");
                }

                if (this.__NPO__ !== 0) {
                    throw TypeError("Not a promise");
                }

                // instance shadowing the inherited "brand"
                // to signal an already "initialized" promise
                this.__NPO__ = 1;

                var def = new MakeDef(this);

                this["then"] = function then(success,failure) {
                    var o = {
                        success: typeof success == "function" ? success : true,
                        failure: typeof failure == "function" ? failure : false
                    };
                    // Note: `then(..)` itself can be borrowed to be used against
                    // a different promise constructor for making the chained promise,
                    // by substituting a different `this` binding.
                    o.promise = new this.constructor(function extractChain(resolve,reject) {
                        if (typeof resolve != "function" || typeof reject != "function") {
                            throw TypeError("Not a function");
                        }

                        o.resolve = resolve;
                        o.reject = reject;
                    });
                    def.chain.push(o);

                    if (def.state !== 0) {
                        schedule(notify,def);
                    }

                    return o.promise;
                };
                this["catch"] = function $catch$(failure) {
                    return this.then(void 0,failure);
                };

                try {
                    executor.call(
                        void 0,
                        function publicResolve(msg){
                            resolve.call(def,msg);
                        },
                        function publicReject(msg) {
                            reject.call(def,msg);
                        }
                    );
                }
                catch (err) {
                    reject.call(def,err);
                }
            }

            var PromisePrototype = builtInProp({},"constructor",Promise,
                                               /*configurable=*/false
                                              );

            builtInProp(
                Promise,"prototype",PromisePrototype,
                /*configurable=*/false
            );

            // built-in "brand" to signal an "uninitialized" promise
            builtInProp(PromisePrototype,"__NPO__",0,
                        /*configurable=*/false
                       );

            builtInProp(Promise,"resolve",function Promise$resolve(msg) {
                var Constructor = this;

                // spec mandated checks
                // note: best "isPromise" check that's practical for now
                if (msg && typeof msg == "object" && msg.__NPO__ === 1) {
                    return msg;
                }

                return new Constructor(function executor(resolve,reject){
                    if (typeof resolve != "function" || typeof reject != "function") {
                        throw TypeError("Not a function");
                    }

                    resolve(msg);
                });
            });

            builtInProp(Promise,"reject",function Promise$reject(msg) {
                return new this(function executor(resolve,reject){
                    if (typeof resolve != "function" || typeof reject != "function") {
                        throw TypeError("Not a function");
                    }

                    reject(msg);
                });
            });

            builtInProp(Promise,"all",function Promise$all(arr) {
                var Constructor = this;

                // spec mandated checks
                if (ToString.call(arr) != "[object Array]") {
                    return Constructor.reject(TypeError("Not an array"));
                }
                if (arr.length === 0) {
                    return Constructor.resolve([]);
                }

                return new Constructor(function executor(resolve,reject){
                    if (typeof resolve != "function" || typeof reject != "function") {
                        throw TypeError("Not a function");
                    }

                    var len = arr.length, msgs = Array(len), count = 0;

                    iteratePromises(Constructor,arr,function resolver(idx,msg) {
                        msgs[idx] = msg;
                        if (++count === len) {
                            resolve(msgs);
                        }
                    },reject);
                });
            });

            builtInProp(Promise,"race",function Promise$race(arr) {
                var Constructor = this;

                // spec mandated checks
                if (ToString.call(arr) != "[object Array]") {
                    return Constructor.reject(TypeError("Not an array"));
                }

                return new Constructor(function executor(resolve,reject){
                    if (typeof resolve != "function" || typeof reject != "function") {
                        throw TypeError("Not a function");
                    }

                    iteratePromises(Constructor,arr,function resolver(idx,msg){
                        resolve(msg);
                    },reject);
                });
            });

            return Promise;
        });
    },

    /*!
     * document.currentScript
     * Polyfill for `document.currentScript`.
     * Copyright (c) 2014 James M. Greene
     * Licensed MIT
     * http://jsfiddle.net/JamesMGreene/9DFc9/
     * v0.1.6
     */
    installPolyfill_document_currentScript : function() {
        var hasStackBeforeThrowing = false,
            hasStackAfterThrowing = false;
        (function() {
            try {
                var err = new Error();
                hasStackBeforeThrowing = typeof err.stack === "string" && !!err.stack;
                throw err;
            }
            catch (thrownErr) {
                hasStackAfterThrowing = typeof thrownErr.stack === "string" && !!thrownErr.stack;
            }
        })();
        // This page's URL
        var pageUrl = window.location.href;
        // Live NodeList collection
        var scripts = document.getElementsByTagName("script");
        // Get script object based on the `src` URL
        function getScriptFromUrl(url) {
            if (typeof url === "string" && url) {
                for (var i = 0, len = scripts.length; i < len; i++) {
                    if (scripts[i].src === url) {
                        return scripts[i];
                    }
                }
            }
            return null;
        }
        // If there is only a single inline script on the page, return it; otherwise `null`
        function getSoleInlineScript() {
            var script = null;
            for (var i = 0, len = scripts.length; i < len; i++) {
                if (!scripts[i].src) {
                    if (script) {
                        return null;
                    }
                    script = scripts[i];
                }
            }
            return script;
        }
        // Get the configured default value for how many layers of stack depth to ignore
        function getStackDepthToSkip() {
            var depth = 0;
            if (
                typeof _currentScript !== "undefined" &&
                    _currentScript &&
                    typeof _currentScript.skipStackDepth === "number"
            ) {
                depth = _currentScript.skipStackDepth;
            }
            return depth;
        }
        // Get the currently executing script URL from an Error stack trace
        function getScriptUrlFromStack(stack, skipStackDepth) {
            var url, matches, remainingStack,
                ignoreMessage = typeof skipStackDepth === "number";
            skipStackDepth = ignoreMessage ? skipStackDepth : getStackDepthToSkip();
            if (typeof stack === "string" && stack) {
                if (ignoreMessage) {
                    matches = stack.match(/(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/);
                }
                else {
                    matches = stack.match(/^(?:|[^:@]*@|.+\)@(?=data:text\/javascript|blob|http[s]?|file)|.+?\s+(?: at |@)(?:[^:\(]+ )*[\(]?)(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/);
                    if (!(matches && matches[1])) {
                        matches = stack.match(/\)@(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/);
                    }
                }
                if (matches && matches[1]) {
                    if (skipStackDepth > 0) {
                        remainingStack = stack.slice(stack.indexOf(matches[0]) + matches[0].length);
                        url = getScriptUrlFromStack(remainingStack, (skipStackDepth - 1));
                    }
                    else {
                        url = matches[1];
                    }
                }
            }
            return url;
        }
        // Get the currently executing `script` DOM element
        function _currentScript() {
            // Yes, this IS actually possible
            if (scripts.length === 0) {
                //console.log( "currentScript null 1");
                return null;
            }
            if (scripts.length === 1) {
                return scripts[0];
            }
            if ("readyState" in scripts[0]) {
                for (var i = scripts.length; i--; ) {
                    if (scripts[i].readyState === "interactive") {
                        return scripts[i];
                    }
                }
            }
            if (document.readyState === "loading") {
                return scripts[scripts.length - 1];
            }
            var stack,
                e = new Error();
            if (hasStackBeforeThrowing) {
                stack = e.stack;
            }
            if (!stack && hasStackAfterThrowing) {
                try {
                    throw e;
                }
                catch (err) {
                    // NOTE: Cannot use `err.sourceURL` or `err.fileName` as they will always be THIS script
                    stack = err.stack;
                }
            }
            if (stack) {
                var url = getScriptUrlFromStack(stack);
                var script = getScriptFromUrl(url);
                if (!script && url === pageUrl) {
                    script = getSoleInlineScript();
                }
                return script;
            }
            //console.log( "currentScript null 1");
            return null;
        }
        // Configuration
        _currentScript.skipStackDepth = 1;
        // Inspect the polyfill-ability of this browser
        var needsPolyfill = !("currentScript" in document);
        var canDefineGetter = document.__defineGetter__;
        var canDefineProp = typeof Object.defineProperty === "function" &&
            (function() {
                var result;
                try {
                    Object.defineProperty(document, "_xyz", {
                        get: function() {
                            return "blah";
                        },
                        configurable: true
                    });
                    result = document._xyz === "blah";
                    delete document._xyz;
                }
                catch (e) {
                    result = false;
                }
                return result;
            })();
        // Add the "private" property for testing, even if the real property can be polyfilled
        document._currentScript = _currentScript;
        // Polyfill it!
        if (needsPolyfill) {
            if (canDefineProp) {
                Object.defineProperty(document, "currentScript", {
                    get: _currentScript
                });
            }
            else if (canDefineGetter) {
                document.__defineGetter__("currentScript", _currentScript);
            }
            else throw new Error( "Could not install polyfill" );
        }
    }
    
});
