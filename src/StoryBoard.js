import * as $ from 'jquery';
import * as _ from 'lodash';
import {ZenzaWatch} from './ZenzaWatchIndex';
import {util} from './util';
import {StoryboardSession} from './loader/Storyboard';
import {Emitter} from './baselib';

/* eslint-disable */
// シークバーのサムネイル関連
// 動ける間になんとか作り上げよう
/*
// マスコットキャラクターのサムネーヨちゃん サムネイルがない時にあらわれる
　 ∧  ∧　  　┌────────────
　( ´ー｀)　 ＜　サムネーヨ
 　＼　< 　　　└───/|────────
　　　＼.＼＿＿＿＿__／/
　　　　 ＼　　　　　／
　　　　　 ∪∪￣∪∪
*/
/* eslint-enable */

//===BEGIN===


class StoryboardModel extends Emitter{
  constructor(params) {
    super();
    this.initialize(params);
  }
}

_.assign(StoryboardModel.prototype, {
  initialize: function (params) {
    this._isAvailable = false;
  },
  _createBlankData: function (info) {
    info = info || {};
    Object.assign(info, {
      format: 'smile',
      status: 'fail',
      duration: 1,
      url: '',
      storyboard: [{
        id: 1,
        url: '',
        thumbnail: {
          width: 1,
          height: 1,
          number: 1,
          interval: 1
        },
        board: {
          rows: 1,
          cols: 1,
          number: 1
        }
      }]
    });
    return info;
  },

  update: function (info, duration) {
    if (!info || info.status !== 'ok') {
      this._info = this._createBlankData();
      this._isAvailable = false;
    } else {
      this._info = info;
      this._isAvailable = true;
    }

    if (this.isDmc()) { // dmcはdurationを返してくれないので仕方なく
      info.duration = duration;
      info.storyboard.forEach(board => {
        board.thumbnail.number =
          Math.floor(duration * 1000 / board.thumbnail.interval);
      });
    }

    this.emitAsync('update');
  },

  reset: function () {
    this._isAvailable = false;
    this.emitAsync('reset');
  },

  unload: function () {
    this._isAvailable = false;
    this.emitAsync('unload');
  },

  isAvailable: function () {
    return !!this._isAvailable;
  },

  hasSubStoryboard: function () {
    return this._info.storyboard.length > 1;
  },

  getStatus: function () {
    return this._info.status;
  },
  getMessage: function () {
    return this._info.message;
  },
  getDuration: function () {
    return parseInt(this._info.duration, 10);
  },

  isDmc: function () {
    return this._info.format === 'dmc';
  },
  getUrl: function (i) {
    if (!this.isDmc()) {
      return this._info.storyboard[i || 0].url;
    } else {
      return this._info.storyboard[i || 0].urls[0];
    }
  },
  getWidth:
    function (i) {
      return parseInt(this._info.storyboard[i || 0].thumbnail.width, 10);
    },
  getHeight:
    function (i) {
      return parseInt(this._info.storyboard[i || 0].thumbnail.height, 10);
    },
  getInterval:
    function (i) {
      return parseInt(this._info.storyboard[i || 0].thumbnail.interval, 10);
    },
  getCount: function (i) {
    return Math.max(
      Math.ceil(this.getDuration() / Math.max(0.01, this.getInterval())),
      parseInt(this._info.storyboard[i || 0].thumbnail.number, 10)
    );
  },
  getRows: function (i) {
    return parseInt(this._info.storyboard[i || 0].board.rows, 10);
  },
  getCols: function (i) {
    return parseInt(this._info.storyboard[i || 0].board.cols, 10);
  },
  getPageCount: function (i) {
    return parseInt(this._info.storyboard[i || 0].board.number, 10);
  },
  getTotalRows: function (i) {
    return Math.ceil(this.getCount(i) / this.getCols(i));
  },

  getPageWidth: function (i) {
    return this.getWidth(i) * this.getCols(i);
  },
  getPageHeight: function (i) {
    return this.getHeight(i) * this.getRows(i);
  },
  getCountPerPage: function (i) {
    return this.getRows(i) * this.getCols(i);
  },

  /**
   *  nページ目のURLを返す。 ゼロオリジン
   */
  getPageUrl: function (page, storyboardIndex) {
    if (!this.isDmc()) {
      page = Math.max(0, Math.min(this.getPageCount(storyboardIndex) - 1, page));
      return this.getUrl(storyboardIndex) + '&board=' + (page + 1);
    } else {
      return this._info.storyboard[storyboardIndex || 0].urls[page];
    }
  },

  /**
   * msに相当するサムネは何番目か？を返す
   */
  getIndex: function (ms, storyboardIndex) {
    // msec -> sec
    let v = Math.floor(ms / 1000);
    v = Math.max(0, Math.min(this.getDuration(), v));

    // サムネの総数 ÷ 秒数
    // Math.maxはゼロ除算対策
    let n = this.getCount(storyboardIndex) / Math.max(1, this.getDuration());

    return parseInt(Math.floor(v * n), 10);
  },

  /**
   * Indexのサムネイルは何番目のページにあるか？を返す
   */
  getPageIndex: function (thumbnailIndex, storyboardIndex) {
    let perPage = this.getCountPerPage(storyboardIndex);
    let pageIndex = parseInt(thumbnailIndex / perPage, 10);
    return Math.max(0, Math.min(this.getPageCount(storyboardIndex), pageIndex));
  },

  /**
   *  msに相当するサムネは何ページの何番目にあるか？を返す
   */
  getThumbnailPosition: function (ms, storyboardIndex) {
    let thumbnailIndex = this.getIndex(ms, storyboardIndex);
    let pageIndex = this.getPageIndex(thumbnailIndex);

    let mod = thumbnailIndex % this.getCountPerPage(storyboardIndex);
    let row = Math.floor(mod / Math.max(1, this.getCols()));
    let col = mod % this.getRows(storyboardIndex);

    return {
      page: pageIndex,
      index: thumbnailIndex,
      row: row,
      col: col
    };
  },

  /**
   * nページ目のx, y座標をmsに変換して返す
   */
  getPointMs: function (x, y, page, storyboardIndex) {
    let width = Math.max(1, this.getWidth(storyboardIndex));
    let height = Math.max(1, this.getHeight(storyboardIndex));
    let row = Math.floor(y / height);
    let col = Math.floor(x / width);
    let mod = x % width;


    // 何番目のサムネに相当するか？
    let point =
      page * this.getCountPerPage(storyboardIndex) +
      row * this.getCols(storyboardIndex) +
      col +
      (mod / width) // 小数点以下は、n番目の左端から何%あたりか
    ;

    // 全体の何%あたり？
    let percent = point / Math.max(1, this.getCount(storyboardIndex));
    percent = Math.max(0, Math.min(100, percent));

    // msは㍉秒単位なので1000倍
    return Math.floor(this.getDuration() * percent * 1000);
  },

  /**
   * msは何ページ目に当たるか？を返す
   */
  getmsPage: function (ms, storyboardIndex) {
    let index = this._storyboard.getIndex(ms, storyboardIndex);
    let page = this._storyboard.getPageIndex(index, storyboardIndex);

    return page;
  },

  /**
   * nページ目のCols, Rowsがsubではどこになるかを返す
   */
  getPointPageColAndRowForSub: function (page, row, col) {
    let mainPageCount = this.getCountPerPage();
    let subPageCount = this.getCountPerPage(1);
    let mainCols = this.getCols();
    let subCols = this.getCols(1);

    let mainIndex = mainPageCount * page + mainCols * row + col;
    let subOffset = mainIndex % subPageCount;

    let subPage = Math.floor(mainIndex / subPageCount);
    let subRow = Math.floor(subOffset / subCols);
    let subCol = subOffset % subCols;

    return {
      page: subPage,
      row: subRow,
      col: subCol
    };
  }

});


class SeekBarThumbnail extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
}
SeekBarThumbnail.BASE_WIDTH = 160;
SeekBarThumbnail.BASE_HEIGHT = 90;

SeekBarThumbnail.__tpl__ = (`
      <div class="zenzaSeekThumbnail">
        <div class="zenzaSeekThumbnail-image"></div>
      </div>
    `).trim();

SeekBarThumbnail.__css__ = (`
      .is-error .zenzaSeekThumbnail,
      .is-loading .zenzaSeekThumbnail {
        display: none !important;
      }

      .zenzaSeekThumbnail {
        display: none;
        pointer-events: none;
      }

      .seekBarContainer:not(.enableCommentPreview) .zenzaSeekThumbnail.show {
        display: block;
        width: 180px;
        height: 100px;
        margin: auto;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid #666;
        border-width: 1px 1px 0 1px;
        background: rgba(0, 0, 0, 0.3);
        padding: 8px 4px;
        border-radius: 8px 8px 0 0;
        z-index: 100;
      }

      .zenzaSeekThumbnail-image {
        background: none repeat scroll 0 0 #999;
        border: 0;
        margin: auto;
        transform-origin: center top;
        transition: background-position 0.1s steps(1, start) 0;
        opacity: 0.8;
      }

    `).trim();

_.assign(SeekBarThumbnail.prototype, {
  initialize: function (params) {
    this._model = params.model;
    this._$container = params.$container;
    this._scale = _.isNumber(params.scale) ? params.scale : 1.0;

    this._preloadImages =
      _.debounce(this._preloadImages.bind(this), 60 * 1000 * 5);
    this._model.on('reset', this._onModelReset.bind(this));
    this._model.on('update', this._onModelUpdate.bind(this));

    ZenzaWatch.debug.seekBarThumbnail = this;
  },
  _onModelUpdate: function () {
    if (!this._model.isAvailable()) {
      this._isAvailable = false;
      this.hide();
      return;
    }
    this.initializeView();

    let model = this._model;
    this._isAvailable = true;
    let width = this._colWidth = Math.max(1, model.getWidth());
    let height = this._rowHeight = Math.max(1, model.getHeight());
    let scale = Math.min(
      SeekBarThumbnail.BASE_WIDTH / width,
      SeekBarThumbnail.BASE_HEIGHT / height
    );

    let css = {
      width: this._colWidth * this._scale,
      height: this._rowHeight * this._scale,
      opacity: '',
      'background-size':
      (model.getCols() * this._colWidth * this._scale) + 'px ' +
      (model.getRows() * this._rowHeight * this._scale) + 'px'
    };
    if (scale > 1.0) {
      css.transform = `scale(${scale})`;
    } else {
      css.transform = '';
    }

    this._$image.css(css);

    this._preloadImages();
    this.show();
  },
  _onModelReset: function () {
    this.hide();
    this._imageUrl = '';
    if (this._$image) {
      this._$image.css('background-image', '');
    }
  },
  _preloadImages: function () {
    // セッションの有効期限が切れる前に全部の画像をロードしてキャッシュに収めておく
    // やっておかないと、しばらく放置した時に読み込めない
    let model = this._model;
    if (!model.isAvailable()) {
      return;
    }
    let pages = model.getPageCount();
    let div = document.createElement('div');
    for (let i = 0; i < pages; i++) {
      let url = model.getPageUrl(i);
      let img = document.createElement('img');
      img.src = url;
      div.appendChild(img);
    }

    this._$preloadImageContainer.empty().append(div);
  },
  show: function () {
    if (!this._$view) {
      return;
    }
    this._$view.addClass('show');
    this.emit('visible', true);
  },
  hide: function () {
    if (!this._$view) {
      return;
    }
    this._$view.removeClass('show');
    this.emit('visible', false);
  },
  initializeView: function () {
    this.initializeView = _.noop;

    if (!SeekBarThumbnail.styleAdded) {
      util.addStyle(SeekBarThumbnail.__css__);
      SeekBarThumbnail.styleAdded = true;
    }
    let $view = this._$view = $(SeekBarThumbnail.__tpl__);
    this._$image = $view.find('.zenzaSeekThumbnail-image');

    this._$preloadImageContainer =
      $('<div class="preloadImageContaienr" style="display: none !important;"></div>');
    $('body').append(this._$preloadImageContainer);

    if (this._$container) {
      this._$container.append($view);
    }
  },
  setCurrentTime: function (sec) {
    if (!this._isAvailable || !this._model.isAvailable() || !this._$image) {
      return;
    }

    let ms = Math.floor(sec * 1000);
    let model = this._model;
    let pos = model.getThumbnailPosition(ms, 0);
    let url = model.getPageUrl(pos.page);
    let x = pos.col * this._colWidth * -1 * this._scale;
    let y = pos.row * this._rowHeight * -1 * this._scale;
    let css = {};
    let updated = false;

    if (this._imageUrl !== url) {
      css.backgroundImage = `url(${url})`;
      this._imageUrl = url;
      updated = true;
    }
    if (this._imageX !== x || this._imageY !== y) {
      css.backgroundPosition = x + 'px ' + y + 'px';
      this._imageX = x;
      this._imageY = y;
      updated = true;
    }

    if (updated) {
      this._updateImageCss(css);
    }
  },
  _updateImageCss: function (css) {
    this._$image.css(css);
  }
});

class Storyboard extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
}
_.assign(Storyboard.prototype, {
  initialize: function (params) {

    this._playerConfig = params.playerConfig;
    this._$container = params.$container;
    this._loader = params.loader || ZenzaWatch.api.StoryboardInfoLoader;


    this._initializeStoryboard();
    ZenzaWatch.debug.storyboard = this;
  },

  _initializeStoryboard: function () {
    this._initializeStoryboard = _.noop;

    if (!this._model) {
      this._model = new StoryboardModel({});
    }
    if (!this._view) {
      this._view = new StoryboardView({
        model: this._model,
        $container: this._$container,
        enable: this._playerConfig.getValue('enableStoryboardBar')
      });
      this._view.on('select', ms => {
        this.emit('command', 'seek', ms / 1000);
      });
      this._view.on('command', (command, param) => {
        this.emit('command', command, param);
      });
    }
  },
  reset: function () {
    this._$container.removeClass('storyboardAvailable');
    this._model.reset();
  },

  onVideoCanPlay: function (watchId, videoInfo) {
    if (!util.isPremium()) {
      return;
    }
    if (!this._playerConfig.getValue('enableStoryboard')) {
      return;
    }

    this._watchId = watchId;

    this._getStoryboardUrl(videoInfo).then(url => {
      if (this._watchId !== watchId) {
        return Promise.reject('video changed');
      }
      if (!url) {
        return Promise.reject('getStoryboardUrl failure');
      }

      this._initializeStoryboard();
      return ZenzaWatch.api.StoryboardInfoLoader.load(url);
    }).then(
      this._onStoryboardInfoLoad.bind(this, watchId, videoInfo.duration)
    ).catch(
      this._onStoryboardInfoLoadFail.bind(this, watchId)
    );
  },
  _getStoryboardUrl: function (videoInfo) {
    let url;
    if (!videoInfo.hasDmcStoryboard) {
      url = videoInfo.storyboardUrl;
      return url ? Promise.resolve(url) : Promise.reject('smile storyboard api not exist');
    }

    const info = videoInfo.dmcStoryboardInfo;
    return (new StoryboardSession(info)).create().then(result => {
      if (result && result.data && result.data.session && result.data.session.content_uri) {
        return result.data.session.content_uri;
      } else {
        return Promise.reject('dmc storyboard api not exist');
      }
    });
  },
  _onStoryboardInfoLoad: function (watchId, duration, info) {
    //window.console.log('onStoryboardInfoLoad', watchId, info);
    if (watchId !== this._watchId) {
      return;
    } // video changed
    this._model.update(info, duration);
    this._$container.toggleClass('storyboardAvailable', this._model.isAvailable());
  },
  _onStoryboardInfoLoadFail: function (watchId, err) {
    //window.console.log('onStoryboardInfoFail', watchId, err);
    if (watchId !== this._watchId) {
      return;
    } // video changed
    this._model.update(null);
    this._$container.removeClass('storyboardAvailable');
  },

  getSeekBarThumbnail: function (params) {
    if (this._seekBarThumbnail) {
      return this._seekBarThumbnail;
    }
    this._seekBarThumbnail = new SeekBarThumbnail({
      model: this._model,
      $container: params.$container
    });
    return this._seekBarThumbnail;
  },

  setCurrentTime: function (sec, forceUpdate) {
    if (this._view && this._model.isAvailable()) {
      this._view.setCurrentTime(sec, forceUpdate);
    }
  },

  _onStoryboardSelect: function (ms) {
    this._emit('command', 'seek', ms / 100);
  },

  toggle: function () {
    if (this._view) {
      this._view.toggle();
      this._playerConfig.setValue('enableStoryboardBar', this._view.isEnable());
    }
  }
});


class StoryboardBlock {
  constructor(...args) {
    this.initialize(...args);
  }
}
_.assign(StoryboardBlock.prototype, {
  initialize: function (option) {
    let height = option.boardHeight;

    this._backgroundPosition = '0 -' + height * option.row + 'px';
    this._src = option.src;
    this._page = option.page;
    this._isLoaded = true;

    let $view = $('<div class="board"/>')
      .css({
        width: option.pageWidth,
        height: height,
        'background-image': `url(${this.src})`,
        'background-position': this._backgroundPosition,
        //'background-size': '',
      })
      .attr({
        'data-src': option.src,
        'data-page': option.page,
        'data-top': height * option.row + height / 2,
        'data-backgroundPosition': this._backgroundPosition
      })
      .append(option.$inner);

    this._isLoaded = true;
    $view.css('background-image', 'url(' + option.src + ')');

    this._$view = $view;
  },
  loadImage: function () {
  },
  getPage: function () {
    return this._page;
  },
  getView: function () {
    return this._$view;
  }
});

class StoryboardBlockBorder {
  constructor(width, height, cols) {
    let $border = $('<div class="border"/>'.repeat(cols)).css({
      width: width,
      height: height
    });
    let $div = $('<div />');
    $div.append($border);
    this._$view = $div;
  }
  getView() {
    return this._$view.clone();
  }
}

class StoryboardBlockList {
  constructor(storyboard) {
    if (storyboard) {
      this.create(storyboard);
    }
  }
}
_.assign(StoryboardBlockList.prototype, {
  create: function (storyboard) {
    let pages = storyboard.getPageCount();
    let pageWidth = storyboard.getPageWidth();
    let width = storyboard.getWidth();
    let height = storyboard.getHeight();
    let rows = storyboard.getRows();
    let cols = storyboard.getCols();

    let totalRows = storyboard.getTotalRows();
    let rowCnt = 0;
    this._$innerBorder =
      new StoryboardBlockBorder(width, height, cols);
    let $view = $('<div class="boardList"/>')
      .css({
        width: storyboard.getCount() * width,
        height: height
      });
    this._$view = $view;
    this._blocks = [];

    for (let i = 0; i < pages; i++) {
      let src = storyboard.getPageUrl(i);
      for (let j = 0; j < rows; j++) {
        let option = {
          width: width,
          pageWidth: pageWidth,
          boardHeight: height,
          page: i,
          row: j,
          src: src
        };
        this.appendBlock(option);
        rowCnt++;
        if (rowCnt >= totalRows) {
          break;
        }
      }
    }

  },
  appendBlock: function (option) {
    option.$inner = this._$innerBorder.getView();
    let block = new StoryboardBlock(option);
    this._blocks.push(block);
    this._$view.append(block.getView());
  },
  loadImage: function (pageNumber) {
  },
  clear: function () {
    this._$view.remove();
  },
  getView: function () {
    return this._$view;
  }
});


class StoryboardView extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
}

_.assign(StoryboardView.prototype, {
  initialize: function (params) {
    console.log('%c initialize StoryboardView', 'background: lightgreen;');
    this._$container = params.$container;

    let sb = this._model = params.model;

    this._isHover = false;
    this._currentUrl = '';
    this._lastPage = -1;
    this._lastMs = -1;
    this._lastGetMs = -1;
    this._scrollLeft = 0;
    this._isEnable = _.isBoolean(params.enable) ? params.enable : true;

    sb.on('update', this._onStoryboardUpdate.bind(this));
    sb.on('reset', this._onStoryboardReset.bind(this));

    let frame = this._requestAnimationFrame = new util.RequestAnimationFrame(
      this._onRequestAnimationFrame.bind(this), 1
    );

    ZenzaWatch.emitter.on('DialogPlayerClose', () => {
      frame.disable();
    });

  },
  enable: function () {
    this._isEnable = true;
    if (this._$view && this._model.isAvailable()) {
      this.open();
    }
  },
  open: function () {
    if (!this._$view) {
      return;
    }
    this._$view.addClass('show');
    this._$body.addClass('zenzaStoryboardOpen');
    this._$container.addClass('zenzaStoryboardOpen');
    this._requestAnimationFrame.enable();
  },
  close: function () {
    if (!this._$view) {
      return;
    }
    this._$view.removeClass('show');
    this._$body.removeClass('zenzaStoryboardOpen');
    this._$container.removeClass('zenzaStoryboardOpen');
    this._requestAnimationFrame.disable();
  },
  disable: function () {
    this._isEnable = false;
    if (this._$view) {
      this.close();
    }
  },
  toggle: function (v) {
    if (typeof v === 'boolean') {
      if (v) {
        this.enable();
      }
      else {
        this.disable();
      }
      return;
    }
    if (this._isEnable) {
      this.disable();
    } else {
      this.enable();
    }
  },
  isEnable: function () {
    return !!this._isEnable;
  },
  _initializeStoryboard: function () {
    this._initializeStoryboard = _.noop;
    window.console.log('%cStoryboardView.initializeStoryboard', 'background: lightgreen;');

    this._$body = $('body');

    util.addStyle(StoryboardView.__css__);
    let $view = this._$view = $(StoryboardView.__tpl__);

    let $inner = this._$inner = $view.find('.storyboardInner');
    this._$failMessage = $view.find('.failMessage');
    this._$cursorTime = $view.find('.cursorTime');
    this._$pointer = $view.find('.storyboardPointer');
    this._inner = $inner[0];

    $view
      .toggleClass('webkit', util.isWebkit())
      .on('click', '.board', this._onBoardClick.bind(this))
      .on('mousemove', '.board', this._onBoardMouseMove.bind(this))
      .on('mousemove', '.board', _.debounce(this._onBoardMouseMoveEnd.bind(this), 300))
      .on('wheel', this._onMouseWheel.bind(this))
      .on('wheel', _.debounce(this._onMouseWheelEnd.bind(this), 300));


    let hoverOutTimer;
    let onHoverOutTimer = () => {
      this._isHover = false;
    };

    let onHoverIn = () => {
      if (hoverOutTimer) {
        window.clearTimeout(hoverOutTimer);
      }
      this._isHover = true;
    };

    let onHoverOut = () => {
      if (hoverOutTimer) {
        window.clearTimeout(hoverOutTimer);
      }
      hoverOutTimer = window.setTimeout(onHoverOutTimer, 1000);
    };

    $inner
      .hover(onHoverIn, onHoverOut)
      .on('touchstart', this._onTouchStart.bind(this))
      //  .on('touchend',    this._onTouchEnd  .bind(this))
      .on('touchmove', this._onTouchMove.bind(this));
    this._bouncedOnToucheMoveEnd = _.debounce(this._onTouchMoveEnd.bind(this), 2000);

    this._$container.append($view);
    document.body.addEventListener('touchend', () => {
      this._isHover = false;
    }, {passive: true});

    this._innerWidth = window.innerWidth;
    window.addEventListener('resize', _.throttle(() => {
      this._innerWidth = window.innerWidth;
    }, 500), {passive: true});
  },
  _onBoardClick: function (e) {
    let $board = $(e.target).closest('.board'), offset = $board.offset();
    let y = $board.attr('data-top') * 1;
    let x = e.pageX - offset.left;
    let page = $board.attr('data-page');
    let ms = this._model.getPointMs(x, y, page);
    if (isNaN(ms)) {
      return;
    }

    let $view = this._$view;
    $view.addClass('clicked');
    window.setTimeout(() => $view.removeClass('clicked'), 1000);
    this._$cursorTime.css({
      transform: 'translate(-999px, 0)'
    });

    this.emit('select', ms);
  },
  _onCommandClick: function (e) {
    let $command = $(e).closest('.command');
    let command = $command.attr('data-command');
    let param = $command.attr('data-param');
    if (!command) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    this.emit('command', command, param);
  },
  _onBoardMouseMove: function (e) {
    let $board = $(e.target).closest('.board'), offset = $board.offset();
    let y = $board.attr('data-top') * 1;
    let x = e.pageX - offset.left;
    let page = $board.attr('data-page');
    let ms = this._model.getPointMs(x, y, page);
    if (isNaN(ms)) {
      return;
    }
    let sec = Math.floor(ms / 1000);

    let time = util.secToTime(sec);
    this._$cursorTime.text(time).css({
      transform: `translate3d(${e.pageX}px, 0, 0) translate(-50%, 0)`
    });

    this._isHover = true;
    this._isMouseMoving = true;
  },
  _onBoardMouseMoveEnd: function (e) {
    this._isMouseMoving = false;
  },
  _onMouseWheel: function (e) {
    // 縦ホイールで左右スクロールできるようにする
    e.stopPropagation();
    let deltaX = parseInt(e.originalEvent.deltaX, 10);
    let delta = parseInt(e.originalEvent.deltaY, 10);
    if (Math.abs(deltaX) > Math.abs(delta)) {
      // 横ホイールがある環境ならなにもしない
      return;
    }
    e.preventDefault();
    this._isHover = true;
    this._isMouseMoving = true;
    let left = this.scrollLeft();
    this.scrollLeft(left + delta * 5, true);
  },
  _onMouseWheelEnd: function (e, delta) {
    this._isMouseMoving = false;
  },
  _onTouchStart: function (e) {
    this._isHover = true;
    this._isMouseMoving = true;
    e.stopPropagation();
  },
  _onTouchEnd: function (e) {
    //this._isHover = false;
    //this._isMouseMoving = false;
    //e.stopPropagation();
  },
  _onTouchMove: function (e) {
    e.stopPropagation();
    this._isHover = true;
    this._isMouseMoving = true;
    this._isTouchMoving = true;
    this._bouncedOnToucheMoveEnd();
  },
  _onTouchMoveEnd: function () {
    this._isTouchMoving = false;
    this._isMouseMoving = false;
  },
  _onTouchCancel: function (e) {
  },
  update: function () {
    this._isHover = false;
    this._timerCount = 0;
    this._scrollLeft = 0;

    this._initializeStoryboard();

    this.close();
    this._$view.removeClass('success fail');
    if (this._model.getStatus() === 'ok') {
      this._updateSuccess();
    } else {
      this._updateFail();
    }
  },
  scrollLeft: function (left, forceUpdate) {
    const inner = this._inner;
    if (!inner) {
      return 0;
    }

    if (left === undefined) {
      return inner.scrollLeft;
    } else if (left === 0 || Math.abs(this._scrollLeft - left) >= 1) {
      if (left === 0 || forceUpdate) {
        inner.scrollLeft = left;
        this._scrollLeftChanged = false;
      } else {
        let sl = inner.scrollLeft;
        this._scrollLeft = (left + sl) / 2;
        this._scrollLeftChanged = true;
      }
    }
  },
  scrollToNext: function () {
    this.scrollLeft(this._model.getWidth());
  },
  scrollToPrev: function () {
    this.scrollLeft(-this._model.getWidth());
  },
  _updateSuccess: function () {
    let url = this._model.getUrl();
    let $view = this._$view;
    $view
      .css('transform', `translate3d(0px, -${this._model.getHeight()}px, 0)`)
      .addClass('success');

    if (this._currentUrl !== url) {
      // 前と同じurl == 同じ動画なら再作成する必要なし
      this._currentUrl = url;
      // 20ms前後かかってるけどもっと軽くできるはず・・・
      window.console.time('createStoryboardDOM');
      this._updateSuccessDom();
      window.console.timeEnd('createStoryboardDOM');
    }

    if (this._isEnable) {
      $view.addClass('opening show');
      this.scrollLeft(0);
      this.open();
      window.setTimeout(() => $view.removeClass('opening'), 1000);
    }

  },
  _updateSuccessDom: function () {
    let list = new StoryboardBlockList(this._model);
    this._storyboardBlockList = list;
    this._$pointer.css({
      width: this._model.getWidth(),
      height: this._model.getHeight(),
    });
    this._$inner.empty().append(list.getView()).append(this._$pointer);
  },
  _updateFail: function () {
    this._$view.removeClass('success').addClass('fail');
  },
  clear: function () {
    if (this._$view) {
      this._$inner.empty();
    }
  },
  _onRequestAnimationFrame: function () {
    if (!this._model.isAvailable()) {
      return;
    }
    if (!this._$view) {
      return;
    }

    if (this._scrollLeftChanged && !this._isHover) {
      // let lastScrollLeft = this._inner.scrollLeft;
      this._inner.scrollLeft = this._scrollLeft;
      this._scrollLeftChanged = false;
      // this._pointerLeft += this._scrollLeft - lastScrollLeft;
      // this._pointerLeftChanged = true;
    }
    if (this._pointerLeftChanged) {
      this._$pointer.css('transform',
        `translate3d(${this._pointerLeft}px, 0, 0) translate(-50%, 0)`
      );
      this._pointerLeftChanged = false;
    }
  },
  setCurrentTime: function (sec, forceUpdate) {
    if (!this._model.isAvailable()) {
      return;
    }
    if (!this._$view) {
      return;
    }
    if (this._lastCurrentTime === sec) {
      return;
    }

    this._lastCurrentTime = sec;
    let ms = sec * 1000;
    let storyboard = this._model;
    let duration = Math.max(1, storyboard.getDuration());
    let per = ms / (duration * 1000);
    let width = storyboard.getWidth();
    let boardWidth = storyboard.getCount() * width;
    let targetLeft = boardWidth * per;

    if (this._pointerLeft !== targetLeft) {
      this._pointerLeft = targetLeft;
      this._pointerLeftChanged = true;
    }

    if (forceUpdate) {
      this.scrollLeft(targetLeft - this._innerWidth * per, true);
    } else {
      if (this._isHover) {
        return;
      }
      this.scrollLeft(targetLeft - this._innerWidth * per);
    }
  },
  _onScroll: function () {
  },
  _onDisableButtonClick: function (e) {
    e.preventDefault();
    e.stopPropagation();

    let $button = this._$disableButton;
    $button.addClass('clicked');
    window.setTimeout(() => $button.removeClass('clicked'), 1000);

    this.emit('disableStoryboard');
  },
  _onStoryboardUpdate: function () {
    this.update();
  },
  _onStoryboardReset: function () {
    if (!this._$view) {
      return;
    }
    this.close();
    this._$view.removeClass('show fail');
  }
});


StoryboardView.__tpl__ = [
  '<div id="storyboardContainer" class="storyboardContainer">',
  '<div class="storyboardHeader">',
  '<div class="cursorTime"></div>',
  '</div>',

  '<div class="storyboardInner">',
  '<div class="storyboardPointer"></div>',
  '</div>',
  '<div class="failMessage">',
  '</div>',
  '</div>',
  '',
  ''].join('');


StoryboardView.__css__ = (`
  .storyboardContainer {
    position: fixed;
    top: calc(100vh + 500px);
    opacity: 0;
    left: 0;
    right: 0;
    width: 100%;
    box-sizing: border-box;
    background-color: rgba(50, 50, 50, 0.5);
    z-index: 9005;
    overflow: hidden;
    box-shadow: 0 -2px 2px #666;
    pointer-events: none;
    transform: translateZ(0);
    display: none;
    contain: layout paint;
  }

  .storyboardContainer.success {
    display: block;
    transition:
      bottom 0.5s ease-in-out,
      top 0.5s ease-in-out,
      transform 0.5s ease-in-out;
  }

  .storyboardContainer * {
    box-sizing: border-box;
    user-select: none;
  }

  .dragging .storyboardContainer,
  .storyboardContainer.show {
    top: 0px;
    z-index: 50;
    opacity: 1;
    pointer-events: auto;
  }

  .dragging .storyboardContainer {
    pointer-events: none;
  }


  .fullScreen  .dragging .storyboardContainer,
  .fullScreen            .storyboardContainer.show{
    top: calc(100% - 10px);
  }

  .storyboardContainer .storyboardInner {
    display: none;
    position: relative;
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    background: #222;
    margin: 0;
  }

  .storyboardContainer.webkit .storyboardInner,
  .storyboardContainer .storyboardInner:hover {
    overflow-x: auto;
  }
  /*.storyboardContainer .storyboardInner::-moz-scrollbar,*/
  .storyboardContainer .storyboardInner::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background: rgba(0, 0, 0, 0);
  }

  /*.storyboardContainer .storyboardInner::-moz-scrollbar-thumb,*/
  .storyboardContainer .storyboardInner::-webkit-scrollbar-thumb {
    border-radius: 6px;
    background: #f8f;
  }

  /*.storyboardContainer .storyboardInner::-moz-scrollbar-button,*/
  .storyboardContainer .storyboardInner::-webkit-scrollbar-button {
    display: none;
  }

  .storyboardContainer.success .storyboardInner {
    display: block;
  }

  .storyboardContainer .storyboardInner .boardList {
    overflow: hidden;
  }

  .storyboardContainer .boardList .board {
    display: inline-block;
    cursor: pointer;
    background-color: #101010;
  }

  .storyboardContainer.clicked .storyboardInner * {
    opacity: 0.3;
    pointer-events: none;
  }

  .storyboardContainer.opening .storyboardInner .boardList .board {
    pointer-events: none;
  }

  .storyboardContainer .boardList .board.loadFail {
    background-color: #c99;
  }

  .storyboardContainer .boardList .board > div {
    white-space: nowrap;
  }
  .storyboardContainer .boardList .board .border {
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border-style: solid;
    border-color: #000 #333 #000 #999;
    border-width: 0     2px    0  2px;
    display: inline-block;
    pointer-events: none;
  }

  .storyboardContainer .storyboardHeader {
    position: relative;
    width: 100%;
  }

  .storyboardContainer .cursorTime {
    display: none;
    position: absolute;
    bottom: -30px;
    left: 0;
    font-size: 10pt;
    border: 1px solid #000;
    z-index: 9010;
    background: #ffc;
    pointer-events: none;
  }
  .storyboardContainer:hover .cursorTime {
    display: block;
  }

  .storyboardContainer.clicked .cursorTime,
  .storyboardContainer.opening .cursorTime {
    display: none;
  }


  .storyboardPointer {
    position: absolute;
    top: 0;
    z-index: 100;
    pointer-events: none;
    transform: translate3d(-50%, 0, 0);
    /*box-shadow: 0 0 4px #333;*/
    background: #ff9;
    opacity: 0.5;
  }

  .storyboardContainer:hover .storyboardPointer {
    box-shadow: 0 0 8px #ccc;
    transition: transform 0.4s ease-out;
  }

    `).trim();


//===END===


export {
  StoryboardModel,
  SeekBarThumbnail,
  Storyboard,
  StoryboardBlock,
  StoryboardBlockBorder,
  StoryboardBlockList,
  StoryboardView
};
