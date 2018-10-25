const d3 = require('d3');
const Tabletop = require('tabletop');
const _ = {
    map: require('lodash/map'),
    uniqBy: require('lodash/uniqBy'),
    capitalize: require('lodash/capitalize'),
    each: require('lodash/each')
};

const InputSanitizer = require('./inputSanitizer');
const Radar = require('../models/radar');
const Quadrant = require('../models/quadrant');
const Ring = require('../models/ring');
const Blip = require('../models/blip');
const GraphingRadar = require('../graphing/radar');
const MalformedDataError = require('../exceptions/malformedDataError');
const SheetNotFoundError = require('../exceptions/sheetNotFoundError');
const ContentValidator = require('./contentValidator');
const Sheet = require('./sheet');
const ExceptionMessages = require('./exceptionMessages');

// adapted from
// SOURCE: https://github.com/thoughtworks/build-your-own-radar/blob/f0a7da23cc8aecc9c2c9e71c0da50825143285e8/src/util/factory.js
function createRadar(data) {
  try {
    var columnNames = data.columns;

    var contentValidator = new ContentValidator(columnNames);
    contentValidator.verifyContent();
    contentValidator.verifyHeaders();

    var all = data;
    var blips = _.map(all, new InputSanitizer().sanitize);

    d3.selectAll(".loading").remove();

    var rings = _.map(_.uniqBy(blips, 'ring'), 'ring');
    var ringMap = {};
    var maxRings = 4;

    _.each(rings, function (ringName, i) {
      if (i == maxRings) {
        throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS);
      }
      ringMap[ringName] = new Ring(ringName, i);
    });

    var quadrants = {};
    _.each(blips, function (blip) {
      if (!quadrants[blip.quadrant]) {
        quadrants[blip.quadrant] = new Quadrant(_.capitalize(blip.quadrant));
      }
      quadrants[blip.quadrant].add(
        new Blip(
          blip.name,
          ringMap[blip.ring],
          blip.isNew.toLowerCase() === 'true',
          blip.topic,
          blip.description
        ));
    });
    var radar = new Radar();
    _.each(quadrants, function (quadrant) {
      radar.addQuadrant(quadrant)
    });
    var size = (window.innerHeight - 133) < 620 ? 620 : window.innerHeight - 133;
    new GraphingRadar(size, radar).init().plot();
  }
  catch (exception) {
    plotErrorMessage(exception);
  }
};

const plotRadar = function (title, blips) {
    document.title = title;
    d3.selectAll(".loading").remove();

    var rings = _.map(_.uniqBy(blips, 'ring'), 'ring');
    var ringMap = {};
    var maxRings = 4;

    _.each(rings, function (ringName, i) {
        if (i == maxRings) {
            throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS);
        }
        ringMap[ringName] = new Ring(ringName, i);
    });

    var quadrants = {};
    _.each(blips, function (blip) {
        if (!quadrants[blip.quadrant]) {
            quadrants[blip.quadrant] = new Quadrant(_.capitalize(blip.quadrant));
        }
        quadrants[blip.quadrant].add(new Blip(blip.name, ringMap[blip.ring], blip.isNew.toLowerCase() === 'true', blip.topic, blip.description))
    });

    var radar = new Radar();
    _.each(quadrants, function (quadrant) {
        radar.addQuadrant(quadrant)
    });

    var size = (window.innerHeight - 133) < 620 ? 620 : window.innerHeight - 133;

    new GraphingRadar(size, radar).init().plot();
}

const GoogleSheet = function (sheetReference, sheetName) {
    var self = {};

    self.build = function () {
        var sheet = new Sheet(sheetReference);
        sheet.exists(function(notFound) {
            if (notFound) {
                plotErrorMessage(notFound);
                return;
            }

            Tabletop.init({
                key: sheet.id,
                callback: createBlips
            });
        });

        function createBlips(__, tabletop) {

            try {

                if (!sheetName) {
                    sheetName = tabletop.foundSheetNames[0];
                }
                var columnNames = tabletop.sheets(sheetName).columnNames;

                var contentValidator = new ContentValidator(columnNames);
                contentValidator.verifyContent();
                contentValidator.verifyHeaders();

                var all = tabletop.sheets(sheetName).all();
                var blips = _.map(all, new InputSanitizer().sanitize);

                plotRadar(tabletop.googleSheetName, blips);
            } catch (exception) {
                plotErrorMessage(exception);
            }
        }
    };

    self.init = function () {
        plotLoading();
        return self;
    };

    return self;
};

const CSVDocument = function () {

  var self = {};

  self.build = function (data) {
    createRadar(data);
  };

  self.init = function () {
    var content = d3.select('body')
        .append('div')
        .attr('class', 'loading')
        .append('div')
        .attr('class', 'input-sheet');

    set_document_title();

    plotLogo(content);

    var bannerText = '<h1>Building your radar...</h1><p>Your Technology Radar will be available in just a few seconds</p>';
    plotBanner(content, bannerText);
    plotFooter(content);

    return self;
  };

  return self;
};

const QueryParams = function (queryString) {
    var decode = function (s) {
        return decodeURIComponent(s.replace(/\+/g, " "));
    };

    var search = /([^&=]+)=?([^&]*)/g;

    var queryParams = {};
    var match;
    while (match = search.exec(queryString))
        queryParams[decode(match[1])] = decode(match[2]);

    return queryParams
};

const DomainName = function (url) {
    var search = /.+:\/\/([^\/]+)/;
    var match = search.exec(decodeURIComponent(url.replace(/\+/g, " ")));
    return match == null ? null : match[1];
}


const FileName = function (url) {
    var search = /([^\/]+)$/;
    var match = search.exec(decodeURIComponent(url.replace(/\+/g, " ")));
    if (match != null) {
        var str = match[1];
        return str;
    }
    return url;
}

const GoogleSheetInput = function () {
    var self = {};

    self.build = function () {
        var domainName = DomainName(window.location.search.substring(1));
        var queryParams = QueryParams(window.location.search.substring(1));

        if (queryParams.localFile) {
            var sheet = CSVDocument();
            var data = require("../resources/radars/" + queryParams.localFile + ".csv");
            sheet.init().build(data);
        }
        else if (queryParams.sheetId) {
            var sheet = GoogleSheet(queryParams.sheetId, queryParams.sheetName);
            console.log(queryParams.sheetName)

            sheet.init().build();
        } else {
            var content = d3.select('body')
                .append('div')
                .attr('class', 'input-sheet');
            set_document_title();

            plotLogo(content);

            var bannerText = '<div><h1>Alliander Tech Radar (IT R&D)</h1></div>';

            plotBanner(content, bannerText);

            // plotForm(content); // for Google sheets
            plotRadars(content);

            plotFooter(content);

        }
    };

    return self;
};

function set_document_title() {
    document.title = "Alliander (IT R&D) Tech Radar";
}

function plotLoading(content) {
    var content = d3.select('body')
        .append('div')
        .attr('class', 'loading')
        .append('div')
        .attr('class', 'input-sheet');

    set_document_title();

    plotLogo(content);

    var bannerText = '<h1>Building your radar...</h1><p>Your Technology Radar will be available in just a few seconds</p>';
    plotBanner(content, bannerText);
    plotFooter(content);
}

function plotLogo(content) {
    content.append('div')
        .attr('class', 'input-sheet__logo')
        .html('<a href="https://www.alliander.com"><img src="/images/alliander-logo.jpg" / ></a>' +
              '&nbsp;&nbsp;&nbsp;&nbsp;' +
              '<a href="https://www.thoughtworks.com"><img src="/images/tw-logo.png" / ></a>'
        );
}

function plotFooter(content) {
    content
        .append('div')
        .attr('id', 'footer')
        .append('div')
        .attr('class', 'footer-content')
        .append('p')
        .html('Bekrachtigd door <a href="https://github.com/thoughtworks/build-your-own-radar"> ThoughtWorks</a>');
}

function plotBanner(content, text) {
    content.append('div')
        .attr('class', 'input-sheet__banner')
        .html(text);

}

function plotForm(content) {
    content.append('div')
        .attr('class', 'input-sheet__form')
        .append('p')
        .html('<strong>Enter the URL of your <a href="https://www.thoughtworks.com/radar/how-to-byor" target="_blank">published</a> Google Sheet or CSV file below…</strong>');

    var form = content.select('.input-sheet__form').append('form')
        .attr('method', 'get');

    form.append('input')
        .attr('type', 'text')
        .attr('name', 'sheetId')
        .attr('placeholder', "e.g. https://docs.google.com/spreadsheets/d/<\sheetid\> or hosted CSV file")
        .attr('required','');

    form.append('button')
        .attr('type', 'submit')
        .append('a')
        .attr('class', 'button')
        .text('Build my radar');

    form.append('p').html("<a href='https://www.thoughtworks.com/radar/how-to-byor'>Need help?</a>");
}

function plotRadars(content) {
  console.log(process.env.RADAR_FILE_NAMES)
  content
    .append('div')
    .attr('class', 'input-sheet__form')
    .attr('style', 'text-align: left')
    .html('<ul>' +
          '  <li><a href="http://localhost:8080/?localFile=2019quarter 5">2019 - 1e kwartaal</a></li>' +
          '  <li><a href="http://localhost:8080/?localFile=2018quarter4">Radar vierde kwartaal 2018</a></li>' +
          '  <li><a href="http://localhost:8080/?localFile=2018quarter3">Radar derde kwartaal 2018</a></li>' +
          '</ul>');
}

function plotErrorMessage(exception) {
    d3.selectAll(".loading").remove();
    var message = 'Oops! It seems like there are some problems with loading your data. ';

    if (exception instanceof MalformedDataError) {
        message = message.concat(exception.message);
    } else if (exception instanceof SheetNotFoundError) {
        message = exception.message;
    } else {
        console.error(exception);
    }

    message = message.concat('<br/>', 'Please check <a href="https://www.thoughtworks.com/radar/how-to-byor">FAQs</a> for possible solutions.');

    d3.select('body')
        .append('div')
        .attr('class', 'error-container')
        .append('div')
        .attr('class', 'error-container__message')
        .append('p')
        .html(message);
}

module.exports = GoogleSheetInput;
