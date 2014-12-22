var m = {

    modules: { },

    _unique: (new Date()).getTime(),

    assert: function( invariant, message ) {
        if (!invariant) {
            console.error(message);
            throw new Error(message);
        }
    },

    addEventListener : function( element , event, fn ) {
        if (element.attachEvent) {
            return element.attachEvent('on'+event,fn);
        } else {
            return element.addEventListener(event,fn,false);
        }
    },

    makeAbsolute : function(url,relativeTo) {
        console.log( "makeAbsolute:" + url + " relativeTo:" + relativeTo );

        if ( relativeTo == undefined )
        {
            console.log( "relative to what?" );
            return url;
        }

        if ( url.match( /^\// ) )
        {
            console.log( "the url is absolute." );
            return url;
        }

        if ( url.match( /^https?:\/\// ))
        {
            console.log( "the url is *REALLY* absolute." );
            return url;
        }

        var relativeToParts = relativeTo.split('/');
        var urlParts = url.split('/');
        relativeToParts.pop();
        while( true )
        {
            console.log( "relativeToParts:" + JSON.stringify( relativeToParts ));
            console.log( "urlParts:" + JSON.stringify( urlParts ));
            if (urlParts[0] == "." )
            {
                urlParts.shift();
                continue;
            }
            if (urlParts[0] == ".." )
            {
                urlParts.shift();
                relativeToParts.pop();
                continue;
            }

            var url = relativeToParts.concat(urlParts);
            var result = url.join('/');

            console.log( "result:" + result );
            return result;
        }
    },

    getUnique : function() {
        return this._unique++;
    },

    modulesJson : function() {
        return JSON.stringify( this.modules , function(key,value) {
            if ( key === "modules" )
                return "/* modules */";
            return value;
        });
    },

    bootstrap: function () {
        console.log( "initializing m.js" );

        this.modules.m = this;

        var head = document.getElementsByTagName('head');
        this.assert( head != undefined ,"Must have a <head> tag" );

        var elements = document.querySelectorAll('script[main]');
        this.assert( elements != undefined , "Must have at least one <script> tag with a main attribute" );
        this.assert( elements.length === 1 , "Must have ONLY one <script> tag with a main attribute" );

        var element = elements[0];
        this.src = element.src;

        this.loadModule("polyfills", "polyfills.js" , function() {
            // this.modules.polyfills.initialize(); // Should happen as a result of this.loadModule()
            //console.log( "loading main script" );
            var mainScript = element.attributes['main'].value;
            this.assert( mainScript.length != 0 , "main attribute must not be empty." );
            this.loadModule("main", mainScript , function() {
                this.assert( this.modules.main , "Main module must exist." );
                this.assert( this.modules.main.initialized , "Main module must be initialized." );
                //console.log("modules:" + this.modulesJson() );
                this.assert( this.isCallable(this.modules.main.main) , "Main module must have a main function:" + this.modules.main.main );
                this.modules.main.main();
            }.bind(this))
        }.bind(this), this.src);
    },

    isCallable: function( value ) { return typeof value === 'function'; },

    loadModule: function( name, url , callback , relativeToUrl ) {
        if ( this.modules[name] !== undefined ) {
            console.log( "module already exists:" + name );
            this.initModuleOnce(name,callback);
            return;
        }

        url = this.makeAbsolute(url,relativeToUrl);
        url += "?_=" + this.getUnique();
        console.log( "loading script:" + url );

        var head = document.getElementsByTagName('head');
        this.assert( head != undefined ,"Must have a <head> tag" );
        this.assert( head.length != 0, "Must have a <head> tag inside document.getElementsByTagName('head')" );
        head = head[0];

        var script = document.createElement('script');
        var done = false;
        script.src=url;
        script.async=true;
        script.onload=script.onreadystatechange=function() {
            if (!done && (!script.readyState || script.readyState === "loaded" || script.readyState === "complete" )) {
                done = true;
                console.log("script loaded");
                var module = this.modules[name];
                if (module === undefined) {
                    console.warn( name + ": script did not provide a module definition. " + url );
                    // If the script did not define a module, that's okay - it could just be a non-m module.
                    this.modules[name] = { name: name , initialized : false , url: url };
                }
                this.initModuleOnce(name,callback);
            }
        }.bind(this);
        //        head.appendChild(script);
        console.log( "inserting script node." );
        head.insertBefore( script, head.firstChild );
    },

    initModuleOnce: function (moduleName,callback) {

        //console.log( moduleName + " - trying to init" );
        var module = this.modules[moduleName];
        if ( module.initialized ) {
            //console.log( moduleName + " - previously inited" );
            return;
        }

        this.assert( module, "can only init a module if it is already loaded." );

        if ( module.dependencies ) {
            for( var name in module.dependencies ) {
                var dependency = this.modules[name];
                if ( dependency && dependency.initialized )
                    continue;

                if ( dependency ) {
                    // the module definition has been loaded, but the dependency is not initialized,
                    // so initialize it, and then try again to initialize this module.
                    this.initModuleOnce(name,function(){
                        //console.log( moduleName + " - initialized dependency:" + name );
                        this.initModuleOnce(moduleName,callback);
                    }.bind(this));
                    return;
                }

                // the dependency does not have a corresponding module definition
                var url = module.dependencies[name].url;
                this.loadModule(name,url,function() {
                    //console.log( moduleName + " - loaded dependency:" + name );
                    this.initModuleOnce(moduleName,callback);
                }.bind(this),module.src);
                return;
            };
        }

        //console.log( moduleName + " - dependencies complete." );
        if ( !module.initialized ) {
            //console.log( moduleName + " - is not initialized. Initializing it now." );
            if ( this.isCallable( module.initialize ) )
                module.initialize();
            module.initialized = true;
        }
        //console.log( moduleName + " - initialized." );
        if ( this.isCallable(callback ) ) {
            callback();
        }

    },

    module: function( module ) {
        console.log( "adding module definition:" + JSON.stringify( module ));
        this.modules[module.name] = module;
    }
};

// most polyfills should be loaded via polyfills.js. Unfortunately, this one is required
// to even get that far. Thanks, IE8.
// http://stackoverflow.com/questions/11054511/how-to-handle-lack-of-javascript-object-bind-method-in-ie-8
if (!Function.prototype.bind) {
    Function.prototype.bind = function(oThis) {
        if (typeof this !== 'function') {
            // closest thing possible to the ECMAScript 5
            // internal IsCallable function
            throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
        }

        var aArgs   = Array.prototype.slice.call(arguments, 1),
            fToBind = this,
            fNOP    = function() {},
            fBound  = function() {
                return fToBind.apply(this instanceof fNOP && oThis
                                     ? this
                                     : oThis,
                                     aArgs.concat(Array.prototype.slice.call(arguments)));
            };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
    };
}

// Again, polyfills should normally be loaded via polyfill.js. This one is required to even get that
// far. Thanks, IE8.
if (!console) {
    var console = {
        _div : null,
        log : function( msg ) {
            return;
            if (!this._div) {
                this._div = document.body.appendChild(document.createElement('div'));
                this._div.className = "CONSOLE";
            }
            var logEntry = document.createElement('div');
            logEntry.innerText = msg;
            this._div.appendChild(logEntry);
        },
        error : function( msg ) { this.log("Error:" + msg); },
        warn : function( msg ) { this.log( "Warn:" + msg); }
    };
}

m.addEventListener(window,"load",m.bootstrap.bind(m));
//window.addEventListener("load", m.bootstrap.bind(m), false);
