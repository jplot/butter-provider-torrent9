'use strict'

const Provider = require('butter-provider')
const request = require('request')
const cheerio = require('cheerio')
const sanitize = require('butter-sanitize')
const _ = require('lodash')
const Q = require('q')
const debug = require('debug')('torrent9')

class Torrent9 extends Provider {

  constructor(args) {
    super(args)

    if (!(this instanceof Torrent9)) return new Torrent9(args)

    const API_TYPES = {
      tvshow: 'series',
      movie: 'films'
    }
    const ITEM_TYPES = {
      tvshow: Provider.ItemType.TVSHOW,
      movie: Provider.ItemType.MOVIE
    }

    this.apiURL = this.args.apiURL
    this.apiType = API_TYPES[this.args.type]
    this.itemType = ITEM_TYPES[this.args.type]
  }

  _formatDetail(old_data) {
    let data = _.extend(old_data, {
      runtime: 1, // TODO fixme
      subtitle: {}, // TODO fixme
      synopsis: 'No synopsis available.',

      // Movie
      // torrents: []
      // trailer: null, // TODO fixme

      // TV Show
      status: 'Unknown', // TODO fixme
    })

    return data
  }

  _formatFetch(data) {
    const $ = cheerio.load(data)
  	const results = $('.table-responsive > table > tbody > tr').map((i, el) => {
      const anchor = $(el).find('td:nth-child(1) > a')
      const peers = parseInt($(el).find('td:nth-child(4)').text().trim())
      const seeds = parseInt($(el).find('td:nth-child(3)').text().trim())
      const [torrent_id] = anchor.attr('href').match(/\/torrent\/(.*)/).splice(1)
      let title = anchor.text()
      let year = null
      let season = null
      let episode = null
      let language = 'VO'
      let quality = Provider.QualityType.LOW

      if (title.match(/720p/i)) {
        quality = Provider.QualityType.MEDIUM
      } else if (title.match(/1080p/i)) {
        quality = Provider.QualityType.HIGH
      }

      if (title.match(/FRENCH/i)) {
        language = 'FRENCH'
      } else if (title.match(/VOSTFR/i)) {
        language = 'VOSTFR'
      }

      if (this.itemType == Provider.ItemType.TVSHOW) {
        if (title.match(/Saison/i)) {
          const matches = title.match(/(.+) Saison (\d+).*/i).slice(1)
          title = matches[0]
          season = matches[1]
          // [title, seasonNumber, language] = title.match(/(.+) Saison (\d+) (\w+).*/i).slice(1)
        } else if (title.match(/S\d+E\d+/i)) {
          const matches = title.match(/(.+) S(\d+)E(\d+).*/i).slice(1)
          title = matches[0]
          season = matches[1]
          episode = matches[2]
          // [title, seasonNumber, episodeNumber] = title.match(/(.+)\s+S(\d+)E(\d+).*/i).slice(1)
        } else if (title.match(/[\d]{3}/)) {
          const matches = title.match(/(.+) (\d)([\d]{2}).*/).slice(1)
          title = matches[0]
          season = matches[1]
          episode = matches[2]
          // [title, seasonNumber, episodeNumber] = title.match(/(.+) (\d)([\d]{2}).*/).slice(1)
        }

        if (title.match(/\([\d]{4}\)$/)) {
          [title, year] = title.match(/(.+) \(([\d]{4})\)$/).slice(1)
          year = parseInt(year)
        }

        if (title.match(/\(.+\)$/)) {
          [title] = title.match(/.+ \((.+)\)$/).slice(1)
        }
      }

      season = parseInt(season)
      episode = parseInt(episode)

      // debug(anchor.text())
      // debug('-----------------')
      // debug(torrent_id, '|', title, '-', year , '-', language, '-', quality)
      // debug('*****************')

      return {
        uniqueId: torrent_id,
        title: title,
        year: year || 2017, // TODO fixme
        genres: ['Unknown'], // TODO fixme
        rating: 100, // TODO fixme
        poster: `${this.apiURL}/_pictures/${torrent_id}.jpg`,
        backdrop: `${this.apiURL}/_pictures/${torrent_id}.jpg`,
        type: this.itemType,
        num_seasons: 1, // TODO fixme

        // Details
        episodes: [{
          torrents: {
            [quality]: {
              url: `${this.apiURL}/get_torrent/${torrent_id}.torrent`,
              size: null, // TODO fixme
              filesize: null, // TODO fixme
              peers: peers,
              seeds: seeds
            }
          },
          watched: false, // TODO fixme
          first_aired: 2017, // TODO fixme
          overview: 'No overview available.',
          episode: episode,
          season: season,
          tvdb_id: 1 // TODO fixme
        }]
      }
    })

  	return {
  		results: sanitize(results),
  		hasMore: true
  	}
  }

  _get(url) {
    return new Promise((resolve, reject) => {
      const options = {
        url: url
      }

      return request.get(options, (err, res, data) => {
        if (err || res.statusCode >= 400) {
          return reject(err || new Error('Status Code is above 400'))
        } else if (!data || data.error) {
          err = data ? data.status_message : 'No data returned'
          return reject(new Error(err))
        } else {
          return resolve(data)
        }
      })
    })
  }

  // extractId(items) {
  //   debug('** extractId')
  //   debug('items:', items)
  //   debug('********')
  // 	// return items.results.map(item => item[Torrent9.prototype.config.uniqueId])
  //   return Provider.extractId(items)
  // }

  fetch(filters) {
    // debug('** fetch')
    // debug('filters:', filters)
    // debug('********')
    const params = {}

    // if (filters.keywords) params.keywords = filters.keywords.replace(/\s/g, '% ')
    // if (filters.genre) params.genre = filters.genre
    // if (filters.order) params.order = filters.order
    // if (filters.sorter && filters.sorter !== 'popularity') params.sort = filters.sorter

    filters.page = filters.page ? filters.page : 0

    const url = `${this.apiURL}/torrents_${this.apiType}.html,page-${filters.page}`
    return this._get(url).then(data => this._formatFetch(data))
  }

  detail(torrent_id, old_data) {
    // debug('** detail')
    // debug('torrent_id:', torrent_id)
    // debug('old_data:', old_data)
    // debug('new_data:', this._formatDetail(old_data))
    // debug('********')

    return Q(this._formatDetail(old_data))
  }

  // random() {
  //   // const url = `${this.apiURL[index]}random/show`
  //   // return this._get(index, url).then(data => this._formatDetail(data))
  //   return Provider.random()
  // }

}

Torrent9.prototype.config = {
  name: 'Torrent9',
  uniqueId: 'uniqueId',
  tabName: 'Torrent9',
  defaults: {
    apiURL: 'http://www.torrent9.biz',
    type: 'tvshow'
  },
  args: {
    apiURL: Provider.ArgType.STRING,
    type: Provider.ArgType.STRING
  }
}

module.exports = Torrent9
