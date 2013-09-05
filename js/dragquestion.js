var H5P = H5P || {};

if (H5P.getPath === undefined) {
  /**
   * Find the path to the content files based on the id of the content
   *
   * Also identifies and returns absolute paths
   *
   * @param {String} path Absolute path to a file, or relative path to a file in the content folder
   * @param {Number} contentId Identifier of the content requesting the path
   * @returns {String} The path to use.
   */
  H5P.getPath = function (path, contentId) {
    if (path.substr(0, 7) === 'http://' || path.substr(0, 8) === 'https://') {
      return path;
    }

    return H5PIntegration.getContentPath(contentId) + path;
  };
}

/**
 * DragQuestion module.
 *
 * @param {jQuery} $
 */
H5P.DragQuestion = (function ($) {

  /**
   * Initialize module.
   *
   * @param {Object} options Run parameters
   * @param {Number} id Content identification
   */
  function C(options, id) {
    this.tryAgain = true;
    this.preventResize = false;

    this.id = id;
    this.options = $.extend(true, {}, {
      scoreShow: 'Show score',
      correct: 'Solution',
      tryAgain: 'Try again',
      question: {
        settings: {
          size: {
            width: 620,
            height: 310
          }
        },
        task: {
          elements: [],
          dropZones: []
        }
      }
    }, options);

    this.userAnswers = [];
    this.$elements = [];
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var that = this;

    this.$container = $container.addClass('h5p-dragquestion').html('<div class="h5p-inner"></div>').children();
    if (this.options.question.settings.background !== undefined) {
      this.$container.css('backgroundImage', 'url("' + H5P.getPath(this.options.question.settings.background.path, this.id) + '")');
    }

    // Add show score button
    var $button = $('<input class="h5p-button" type="submit" value="' + this.options.scoreShow + '"/>').appendTo(this.$container).click(function () {
      if ($button.hasClass('h5p-try-again')) {
        $button.val(that.options.scoreShow).removeClass('h5p-try-again');
        that.hideSolutions();
      }
      else if (that.showSolutions()) {
        if (that.tryAgain) {
          $button.val(that.options.tryAgain).addClass('h5p-try-again');
        }
        else {
          $button.remove();
        }
      }
    });
    // TODO: Make sure the following libs hide this button: 'H5P.QuestionSet', 'H5P.BoardGame', 'H5P.CoursePresentation'

    var $element, task = this.options.question.task;

    // Add drop zones
    for (var i = 0; i < task.dropZones.length; i++) {
      var dropZone = task.dropZones[i];

      var html = '<div class="h5p-inner"></div>';
      if (dropZone.showLabel) {
        html = '<div class="h5p-label">' + dropZone.label + '</div>' + html;
      }

      $element = this.addElement(dropZone, 'dropzone', i).html(html).children('.h5p-inner').droppable({
        activeClass: 'h5p-active',
        tolerance: 'intersect',
        accept: function (draggable) {
          // Check that the draggable belongs to this task.
          var $draggable = that.$container.find(draggable);
          if ($draggable.length) {
            // Check that the draggable has this drop zone.
            var id = $(this).parent().data('id');
            var draggableDropZones = task.elements[$draggable.data('id')].dropZones;
            for (var i = 0; i < draggableDropZones.length; i++) {
              if (parseInt(draggableDropZones[i]) === id) {
                return true;
              }
            }
          }

          return false;
        },
        drop: function (event, ui) {
          $(this).removeClass('h5p-over');
          ui.draggable.data('addToZone', $(this).parent().data('id'));
        },
        over: function (event, ui) {
          $(this).addClass('h5p-over');
        },
        out: function (event, ui) {
          $(this).removeClass('h5p-over');
        }
      }).end();
    }

    // Add elements (static and draggable)
    for (var i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones !== undefined && element.dropZones.length !== 0) {
        // Add draggable element
        $element = this.$elements[i] = this.addElement(element, 'draggable', i).draggable({
          revert: function (event, ui) {
            var $this = $(this);
            var element = task.elements[$this.data('id')];
            $this.data("uiDraggable").originalPosition = {
              top: element.y + '%',
              left: element.x + '%'
            };
            return !event;
          },
          start: function(event, ui) {
            // Send element to the top!
            $(this).detach().appendTo(that.$container);
          },
          stop: function(event, ui) {
            var $this = $(this);
            var position = that.positionToPercentage($this);
            $this.css(position);

            // Remove from zone
            var zone = $this.data('content');
            var id = $this.data('id');
            if (zone !== undefined && that.userAnswers[zone] !== undefined) {
              $this.removeData('content');
              var zoneAnswers = that.userAnswers[zone];
              for (var i = 0; i < zoneAnswers.length; i++) {
                if (zoneAnswers[i].id === id) {
                  zoneAnswers.splice(i, 1);
                }
              }
            }

            var addToZone = $this.data('addToZone');
            if (addToZone !== undefined) {
              $this.removeData('addToZone').data('content', addToZone);

              // Add to zone answers
              if (that.userAnswers[addToZone] === undefined) {
                that.userAnswers[addToZone] = [];
              }
              that.userAnswers[addToZone].push({
                id: id,
                position: position
              });
            }
          }
        });
      }
      else {
        // Add static element
        $element = this.addElement(element, 'static', i);
      }

      var elementInstance = new (H5P.classFromName(element.type.library.split(' ')[0]))(element.type.params, this.id);
      elementInstance.attach($element);
    }

    // Restore user answers
    for (var i = 0; i < that.userAnswers.length; i++) {
      var dropZoneAnswers = that.userAnswers[i];
      if (dropZoneAnswers !== undefined) {
        for (var j = 0; j < dropZoneAnswers.length; j++) {
          this.$elements[dropZoneAnswers[j].id].css(dropZoneAnswers[j].css).data('content', i);
        }
      }
    }

    if (this.preventResize === false) {
      H5P.$window.bind('resize', function () {
        that.resize();
      });
    }
    this.resize();
  };

  /**
   * Add element/drop zone to task.
   *
   * @param {Object} element
   * @param {String} type Class
   * @param {Number} id
   * @returns {jQuery}
   */
  C.prototype.addElement = function (element, type, id) {
    return $('<div class="h5p-' + type + '" style="left:' + element.x + '%;top:' + element.y + '%;width:' + element.width + 'em;height:' + element.height + 'em"></div>').appendTo(this.$container).data('id', id);
  };

  /**
   * Set correct height of container
   */
  C.prototype.resize = function () {
    var fullscreenOn = H5P.$body.hasClass('h5p-fullscreen') || H5P.$body.hasClass('h5p-semi-fullscreen');
    if (!fullscreenOn) {
      // Make sure we use all the height we can get. Needed to scale up.
      this.$container.css('height', '99999px');
    }

    var size = this.options.question.settings.size;
    var ratio = size.width / size.height;
    var width = this.$container.parent().width();
    var height = this.$container.parent().height();

    if (width / height >= ratio) {
      // Wider
      width = height * ratio;
    }
    else {
      // Narrower
      height = width / ratio;
    }

    this.$container.css({
      width: width + 'px',
      height: height + 'px',
      fontSize: (16 * (width / size.width)) + 'px'
    });
  };

  /**
   * Get css position in percentage.
   *
   * @param {jQuery} $element
   * @returns {Object} CSS position
   */
  C.prototype.positionToPercentage = function ($element) {
    return {
      top: (parseInt($element.css('top')) * 100 / this.$container.innerHeight()) + '%',
      left: (parseInt($element.css('left')) * 100 / this.$container.innerWidth()) + '%'
    };
  };

  /**
   * Display the correct solution for the input boxes.
   */
  C.prototype.showSolutions = function () {
    var task = this.options.question.task;
    this.points = 0;

    // Create map over correct drop zones for elements
    var map = [];
    for (var i = 0; i < task.dropZones.length; i++) {
      var correctElements = task.dropZones[i].correctElements;
      for (var j = 0; j < correctElements.length; j++) {
        var correctElement = correctElements[j];
        if (map[correctElement] === undefined) {
          map[correctElement] = [];
        }
        map[correctElement].push(i);
      }
    }

    for (var i = 0; i < this.$elements.length; i++) {
      var $element = this.$elements[i];
      if ($element === undefined) {
        continue;
      }

      // Disable dragging
      $element.draggable('disable');

      // Find out where we are.
      var dropZone = $element.data('content');

      if (map[i] === undefined) {
        // We should not be anywhere.
        if (dropZone !== undefined) {
          // ... but we are!
          $element.addClass('h5p-wrong');
        }
        else {
          this.points++;
        }
        continue;
      }

      // Are we somewhere we should be?
      var correct = false;
      for (var j = 0; j < map[i].length; j++) {
        if (dropZone === map[i][j]) {
          correct = true;
          $element.addClass('h5p-correct');
          this.points++;
          break;
        }
      }
      if (!correct) {
        $element.addClass('h5p-wrong');
      }
    }

    return true;
  };

  /**
   * Hide solutions. (/try again)
   */
  C.prototype.hideSolutions = function () {
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined) {
        this.$elements[i].removeClass('h5p-wrong h5p-correct').draggable('enable');
      }
    }
    delete this.points;
  };

  /**
   * Get maximum score.
   *
   * @returns {Number} Max points
   */
  C.prototype.getMaxScore = function () {
    var max = 0;
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined) {
        max++;
      }
    }

    return max;
  };

  /**
   * Count the number of correct answers.
   * Only works while showing solution.
   *
   * @returns {Number} Points
   */
  C.prototype.getScore = function () {
    if (this.points !== undefined) {
      return this.points;
    }
  };

  return C;
})(H5P.jQuery);