'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

afterLoad(function () {
    // 寻找插入点
    var elt = document.createElement('div');
    var insetElt = document.getElementById('wrapper') || document.getElementById('root').childNodes[1] //skip <header>
    || document.body;
    insetElt.insertBefore(elt, insetElt.firstChild);

    // 运行Vue实例
    new Vue({ render: function render(ce) {
            return ce({
                template: PXER_TEMPLATE,
                data: function data() {
                    return {
                        pxer: new PxerApp(),
                        showAll: false,
                        state: 'standby', //[standby|init|ready|page|works|finish|re-ready|stop|error]
                        stateMap: {
                            standby: '待命',
                            init: '初始化',
                            ready: '就绪',
                            page: '抓取页码中',
                            works: '抓取作品中',
                            finish: '完成',
                            're-ready': '再抓取就绪',
                            stop: '用户手动停止',
                            error: '出错'
                        },
                        pxerVersion: window['PXER_VERSION'],
                        showPxerFailWindow: false,
                        runTimeTimestamp: 0,
                        runTimeTimer: null,
                        checkedFailWorksList: [],
                        taskInfo: '',
                        tryFailWroksList: [],
                        showTaskOption: false,
                        taskOption: {
                            limit: '',
                            stopId: ''
                        },
                        showLoadBtn: true,
                        errmsg: '',
                        analytics: new PxerAnalytics()
                    };
                },
                created: function created() {
                    var _this = this;

                    window['PXER_VM'] = this;
                    window['PXER_ANALYTICS'] = this.analytics;
                    this.analytics.postData("pxer.app.created", {});
                    this.pxer.on('error', function (err) {
                        _this.errmsg = err;
                    });
                    this.pxer.on('finishWorksTask', function (result) {
                        _this.analytics.postData("pxer.app.finish", {
                            result_count: result.length,
                            ptm_config: _this.pxer.ptmConfig,
                            task_option: _this.pxer.taskOption,
                            error_count: _this.pxer.failList.length
                        });
                    });
                },

                computed: {
                    pageType: function pageType() {
                        var map = {
                            'member_works': '作品列表页',
                            'search': '检索页',
                            'bookmark_works': '收藏列表页',
                            'rank': '排行榜',
                            'bookmark_new': '关注的新作品',
                            'discovery': '探索',
                            'unknown': '未知'
                        };
                        return map[this.pxer.pageType];
                    },
                    isRunning: function isRunning() {
                        var runState = ['page', 'works'];
                        return runState.indexOf(this.state) !== -1;
                    },
                    worksNum: function worksNum() {
                        return this.pxer.taskOption.limit || this.pxer.worksNum;
                    },
                    taskCount: function taskCount() {
                        var pageWorkCount = getOnePageWorkCount(this.pxer.pageType);
                        return Math.ceil(this.worksNum / pageWorkCount) + +this.worksNum;
                    },
                    finishCount: function finishCount() {
                        if (this.state === 'page') {
                            return this.pxer.taskList.filter(function (pr) {
                                return pr.completed;
                            }).length;
                        } else if (this.state === 'works') {
                            return this.pxer.taskList.filter(function (pr) {
                                return pr.completed;
                            }).length + ~~(this.worksNum / 20) + this.pxer.failList.length;
                        } else {
                            return -1;
                        };
                    },
                    forecastTime: function forecastTime() {
                        if (this.isRunning && this.finishCount) {
                            return Math.ceil(this.runTimeTimestamp / this.finishCount * this.taskCount - this.runTimeTimestamp);
                        } else {
                            return -1;
                        };
                    },

                    printConfigUgoira: {
                        get: function get() {
                            return this.pxer.ppConfig.ugoira_zip + '-' + this.pxer.ppConfig.ugoira_frames;
                        },
                        set: function set(value) {
                            var arr = value.split('-');
                            this.pxer.ppConfig.ugoira_zip = arr[0];
                            this.pxer.ppConfig.ugoira_frames = arr[1];
                        }
                    },
                    no_tag_any: {
                        get: function get() {
                            return this.pxer.pfConfig.no_tag_any.join(' ');
                        },
                        set: function set(value) {
                            this.pxer.pfConfig.no_tag_any = value.split(' ');
                        }
                    },
                    no_tag_every: {
                        get: function get() {
                            return this.pxer.pfConfig.no_tag_every.join(' ');
                        },
                        set: function set(value) {
                            this.pxer.pfConfig.no_tag_every = value.split(' ');
                        }
                    },
                    has_tag_some: {
                        get: function get() {
                            return this.pxer.pfConfig.has_tag_some.join(' ');
                        },
                        set: function set(value) {
                            this.pxer.pfConfig.has_tag_some = value.split(' ');
                        }
                    },
                    has_tag_every: {
                        get: function get() {
                            return this.pxer.pfConfig.has_tag_every.join(' ');
                        },
                        set: function set(value) {
                            this.pxer.pfConfig.has_tag_every = value.split(' ');
                        }
                    },
                    showFailTaskList: function showFailTaskList() {
                        var _this2 = this;

                        return this.pxer.failList.filter(function (pfi) {
                            return _this2.tryFailWroksList.indexOf(pfi) === -1;
                        });
                    }
                },
                watch: {
                    state: function state(newValue, oldValue) {},
                    isRunning: function isRunning(value) {
                        var _this3 = this;

                        if (value && this.runTimeTimer === null) {
                            this.runTimeTimer = setInterval(function () {
                                return _this3.runTimeTimestamp++;
                            }, 1000);
                        } else {
                            clearInterval(this.runTimeTimer);
                            this.runTimeTimer = null;
                        }
                    }
                },
                methods: {
                    load: function load() {
                        var _this4 = this;

                        this.state = 'init';
                        if (this.pxer.pageType === 'works_medium') {
                            this.showLoadBtn = false;
                            this.pxer.one('finishWorksTask', function () {
                                _this4.showLoadBtn = true;
                                _this4.state = 'standby';
                            });
                            this.pxer.getThis();
                        } else {
                            this.pxer.init().then(function () {
                                return _this4.state = 'ready';
                            });
                            this.pxer.on('finishWorksTask', function () {
                                window.blinkTitle();
                            });
                        }
                        this.analytics.postData("pxer.app.load", {
                            page_type: this.pxer.pageType
                        });
                    },
                    run: function run() {
                        var _this5 = this;

                        this.analytics.postData("pxer.app.start", {
                            ptm_config: this.pxer.ptmConfig,
                            task_option: this.pxer.taskOption,
                            vm_state: this.state
                        });
                        if (this.state === 'ready') {
                            this.state = 'page';
                            this.pxer.initPageTask();
                            this.pxer.one('finishPageTask', function () {
                                _this5.state = 'works';
                                _this5.pxer.switchPage2Works();
                                _this5.pxer.executeWroksTask();
                            });
                            this.pxer.one('finishWorksTask', function () {
                                _this5.state = 'finish';
                            });
                            this.pxer.executePageTask();
                        } else if (this.state === 're-ready') {
                            this.state = 'works';
                            this.pxer.one('finishWorksTask', function () {
                                _this5.state = 'finish';
                            });
                            this.pxer.executeFailWroks(this.tryFailWroksList);
                            this.tryFailWroksList = [];
                        }
                    },
                    stop: function stop() {
                        this.state = 'stop';
                        this.pxer.stop();
                        this.analytics.postData("pxer.app.halt", {
                            task_count: this.taskCount,
                            finish_count: this.finishCount
                        });
                    },
                    count: function count() {
                        this.taskInfo = this.pxer.getWorksInfo();
                    },
                    printWorks: function printWorks() {
                        this.pxer.printWorks();
                        var sanitizedpfConfig = {};
                        for (var key in this.pxer.pfConfig) {
                            sanitizedpfConfig[key] = this.pxer.pfConfig[key].length ? this.pxer.pfConfig[key].length : this.pxer.pfConfig[key];
                        }
                        this.analytics.postData("pxer.app.print", {
                            pp_config: this.pxer.ppConfig,
                            pf_config: sanitizedpfConfig,
                            task_option: this.pxer.taskOption
                        });
                    },
                    useTaskOption: function useTaskOption() {
                        this.showTaskOption = false;
                        this.analytics.postData("pxer.app.taskoption", {
                            task_option: this.taskOption
                        });
                        Object.assign(this.pxer.taskOption, this.taskOption);
                    },
                    formatFailType: function formatFailType(type) {
                        return {
                            'empty': '获取内容失败',
                            'timeout': '获取超时',
                            'r-18': '限制级作品（R-18）',
                            'r-18g': '怪诞作品（R-18G）',
                            'mypixiv': '仅好P友可见的作品',
                            'parse': '解析错误'
                        }[type] || type;
                    },
                    formatFailSolution: function formatFailSolution(type) {
                        return {
                            'empty': '点击左侧链接确认内容正确，再试一次~',
                            'timeout': '增加最大等待时间再试一次~',
                            'r-18': '开启账号R-18选项',
                            'r-18g': '开启账号R-18G选项',
                            'mypixiv': '添加画师好友再尝试',
                            'parse': '再试一次，若问题依旧，请<a href="https://github.com/pea3nut/Pxer/issues/5" target="_blank">反馈</a>给花生'
                        }[type] || '要不。。。再试一次？';
                    },
                    tryCheckedPfi: function tryCheckedPfi() {
                        var _tryFailWroksList;

                        (_tryFailWroksList = this.tryFailWroksList).push.apply(_tryFailWroksList, _toConsumableArray(this.checkedFailWorksList));
                        this.analytics.postData("pxer.app.reready", {
                            checked_works: this.checkedFailWorksList
                        });
                        this.checkedFailWorksList = [];
                        this.state = 're-ready';
                    },
                    formatTime: function formatTime(s) {
                        return ~~(s / 60) + ':' + (s % 60 >= 10 ? s % 60 : '0' + s % 60);
                    }
                }
            });
        } }).$mount(elt);
});