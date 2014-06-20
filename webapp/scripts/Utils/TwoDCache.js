// This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["Utils/RequestCounter"],
    function (RequestCounter) {
        return function TwoDCache(col_ordinal, provider, update_callback) {
            var that = {};
            that.init = function (col_ordinal, provider, update_callback) {
                that.col_ordinal = col_ordinal;
                that.provider = provider;
                that.update_callback = update_callback;
                that.request_counter = RequestCounter();

                that.intervals = [];
                that.provider_queue = [];
                that.current_provider_requests = 0;
                that.row_data_fetched = false;
                that.row_data = {};
            };

            that.merge = function (arrays) {
                var length = _.map(arrays, DQX.attr('length')).reduce(function(sum, num) {
                    return sum + num;
                });
                //Assumes all are the same type
                var result = new arrays[0].constructor(length);
                var pos = 0;
                _.forEach(arrays, function(array) {
                    if (result.set)
                      result.set(array,pos);
                    else
                      for (var i = 0; i < array.length;i++)
                        result[i+pos] = array[i];
                    pos += array.length;
                });
                return result;
            };

            that.merge2D = function (arrays) {
                arrays = _.filter(arrays, function(array) {
                    return array.length > 0;
                });
                if (arrays.length == 0) {
                    return [];
                }
                var col_length = _.map(arrays, function(array) {
                    return array[0].length;
                }).reduce(function(sum, num) {
                    return sum + num;
                });
                var row_length = arrays[0].length;
                //Assumes all are the same type
                var result = _.times(row_length, function() {
                    return new arrays[0][0].constructor(col_length);
                });
                var pos = 0;
                _.forEach(arrays, function(array) {
                    for(var i = 0; i < row_length; i++)
                      if (result[i].set)
                        result[i].set(array[i],pos);
                      else
                        for (var j = 0; j < array[i].length;j++)
                          result[i][j+pos] = array[i][j];
                    pos += array[0].length;
                });
                return result;
            };

            that.find_start = function(array, threshold) {
                var len = array.length;
                var index = -1;
                while (++index < len) {
                    if (array[index] >= threshold) {
                        break;
                    }
                }
                return index;
            };
            that.find_end = function(array, threshold) {
                var index = array.length;
                while (index--) {
                    if (array[index] < threshold) {
                        break;
                    }
                }
                return index+1;
            };
            that.slice = function(array, start, end) {
                if (array.slice) {
                    return array.slice(start,end);
                }
                if (array.subarray) {
                    return array.subarray(start,end);
                }
                DQX.reportError('No slice available for array');
            };
            that.twoD_col_slice = function(array, start, end) {
                return _.map(array, function(row) {
                    return that.slice(row, start, end);
                });
            };

            //TODO Chunk requests to a multiple of 10 boundary or something to prevent small intervals
            that.get_by_ordinal = function (start, end, retrieve_missing) {
                var bisect, i, last_match, matching_intervals, missing_intervals, ref;
                var result = {'row':that.row_data, 'col':{}, 'twoD':{}};
                if (retrieve_missing == null) retrieve_missing = true;
                if (start < 0) start = 0;
                if (end < 0) end = 0;
                if (start == end) return result;
                var matching_intervals_with_data = that.intervals.filter(function (interval) {
                    return interval.start <= end && start <= interval.end && interval.fetched && !interval.overlimit;
                });
                var interval, col_ordinal_array, start_index, end_index;
                if (matching_intervals_with_data.length == 1) {
                    interval = matching_intervals_with_data[0];
                    col_ordinal_array = interval.col[that.col_ordinal];
                    start_index = that.find_start(col_ordinal_array, start);
                    end_index = that.find_end(col_ordinal_array, end);
                    _.forEach(interval.col, function(array, prop) {
                        result.col[prop] = that.slice(array, start_index, end_index);
                    });
                    _.forEach(interval.twoD, function(array, prop) {
                        result.twoD[prop] = that.twoD_col_slice(array, start_index, end_index);
                    });
                } else if (matching_intervals_with_data.length > 1) {
                    //Take the matching from the first interval
                    interval = matching_intervals_with_data[0];
                    col_ordinal_array = interval.col[that.col_ordinal];
                    start_index = that.find_start(col_ordinal_array, start);
                    end_index = col_ordinal_array.length;
                    _.forEach(interval.col, function(array, prop) {
                        result.col[prop] = [that.slice(array, start_index, end_index)];
                    });
                    _.forEach(interval.twoD, function(array, prop) {
                        result.twoD[prop] = [that.twoD_col_slice(array, start_index, end_index)];
                    });
                    //Then add in the intervals that are fully covered
                    for (i=1; i < matching_intervals_with_data.length - 1; i++) {
                        interval = matching_intervals_with_data[i];
                        _.forEach(interval.col, function(array, prop) {
                            result.col[prop].push(array);
                        });
                        _.forEach(interval.twoD, function(array, prop) {
                            result.twoD[prop].push(array);
                        });
                    }
                    //Take the matching from the last interval
                    interval = matching_intervals_with_data[matching_intervals_with_data.length - 1];
                    col_ordinal_array = interval.col[that.col_ordinal];
                    start_index = 0;
                    end_index = that.find_start(col_ordinal_array, end);
                    _.forEach(interval.col, function(array, prop) {
                        result.col[prop].push(that.slice(array, start_index, end_index));
                    });
                    _.forEach(interval.twoD, function(array, prop) {
                        result.twoD[prop].push(that.twoD_col_slice(array, start_index, end_index));
                    });
                    //Merge the result
                    _.forEach(interval.col, function(array, prop) {
                        result.col[prop] = that.merge(result.col[prop]);
                    });
                    _.forEach(interval.twoD, function(array, prop) {
                        result.twoD[prop] = that.merge2D(result.twoD[prop]);
                    });
                }
                missing_intervals = [];
                //Calculate the nearest power of 2 that would split the request region into 10 pieces
                var target_interval_size = Math.pow(2, Math.round(Math.log((end-start)/10)/Math.log(2)));
                //Round the edges so that we can put out requests on consistent boundaries
                var rounded_start = Math.floor(start/target_interval_size)*target_interval_size;
                var rounded_end = Math.ceil(end/target_interval_size)*target_interval_size;
                //Refind the matching intervals based on rounded boundaries such that we don't re-request smaller regions that could be lying there
                matching_intervals = that.intervals.filter(function (interval) {
                    //Match by the rounded intervals
                    return interval.start <= rounded_end && rounded_start <= interval.end;
                });
                //If it's all missing mark the whole region
                if (matching_intervals.length === 0) {
                    missing_intervals.push({
                        'start': rounded_start,
                        'end': rounded_end
                    });
                }
                //Mark the start to the first found
                if (matching_intervals.length > 0) {
                    if (start < matching_intervals[0].start) {
                        missing_intervals.push({
                            'start': rounded_start,
                            'end': matching_intervals[0].start
                        });
                    }
                }
                //Mark missing bits between regions
                if (matching_intervals.length > 1) {
                    for (i = 1, ref = matching_intervals.length - 1; i <= ref; i++) {
                        if (matching_intervals[i - 1].end !== matching_intervals[i].start) {
                            missing_intervals.push({
                                'start': matching_intervals[i - 1].end,
                                'end': matching_intervals[i].start
                            });
                        }
                    }
                }
                if (matching_intervals.length > 0) {
                    last_match = matching_intervals[matching_intervals.length - 1];
                    if (end > last_match.end) {
                        missing_intervals.push({
                            'start': last_match.end,
                            'end': Math.ceil(end/1000)*1000
                        });
                    }
                }
                //Add any overlimit intervals that are now too big to the missing set and remove.
                //It will be split to smaller requests
                var overlimit_intervals = matching_intervals.filter(function (interval) {
                   return interval.overlimit && (interval.end - interval.start) > target_interval_size;
                });
                _.forEach(overlimit_intervals, function(overlimit_interval) {
                   missing_intervals.push(overlimit_interval);
                   that.intervals = that.intervals.filter(function (interval) {
                       return overlimit_interval !== interval;
                   })
                });

                bisect = d3.bisector(function (interval) {
                    return interval.start;
                }).left;
                //Split the missing regions into ones of the target size if they are bigger and are overlimit
                var resized_missing_intervals = [];
                for (i = 0, ref = missing_intervals.length; i < ref; i++) {
                    interval = missing_intervals[i];
                    if (interval.end - interval.start < target_interval_size && interval.overlimit)
                        resized_missing_intervals.push(interval);
                    else {
                        var i_start = interval.start;
                        while (i_start + target_interval_size < interval.end) {
                            resized_missing_intervals.push({start: i_start, end: i_start + target_interval_size});
                            i_start += target_interval_size;
                        }
                        resized_missing_intervals.push({start: i_start, end: interval.end});
                    }
                }
                missing_intervals = resized_missing_intervals;

                if (retrieve_missing) {
                    for (i = 0, ref = missing_intervals.length; i < ref; i++) {
                        interval = missing_intervals[i];
                        interval.fetched = false;
                        that.intervals.splice(bisect(that.intervals, interval.start), 0, interval);
                        that._add_to_provider_queue(interval);
                    }
                }
                result.intervals_being_fetched = matching_intervals.filter(function (interval) {
                  return !interval.fetched;
                });
                result.intervals_overlimit = matching_intervals.filter(function (interval) {
                  return interval.overlimit;
                });
                result.intervals = that.intervals;
                return result;
            };

            that._add_to_provider_queue = function (interval) {
                that.provider_queue.push(interval);
                if (that.provider_queue.length == 1) {
                    that._process_provider_queue()
                }
            };

            that._process_provider_queue = function () {
                if (that.request_counter.free() && that.provider_queue.length > 0) {
                    var interval = that.provider_queue.pop();
                    that.provider(interval.start, interval.end, that._insert_received_data);
                    that.request_counter.increment();
                }
                if (that.provider_queue.length > 0) {
                    setTimeout(that._process_provider_queue, 100);
                }
            };

            that._insert_received_data = function (start, end, data) {
                that.request_counter.decrement();
                var match;
                match = that.intervals.filter(function (i) {
                    return i.start === start && i.end === end;
                });
                if (match.length !== 1) {
                    console.log("Got data for non-existant interval or multiples", start, end);
                    return;
                }
                match = match[0];
                if (data) {
                    match.fetched = true;
                    var props = _.keys(data);
                    //Check that we didn't go over limit
                    if (props[0] == '_over_col_limit') {
                      match.overlimit = true;
                    } else {
                      match.col = {};
                      match.twoD = {};
                      for (var i = 0, ref = props.length; i < ref; i++) {
                        var full_prop = props[i];
                        var type = full_prop.split('_')[0];
                        var prop = full_prop.substring(full_prop.indexOf('_') + 1);
                        if (type == 'col')
                          match.col[prop] = data[full_prop].array;
                        if (type == 'row')
                          that.row_data[prop] = data[full_prop].array;
                        if (type == '2D') {
                          var packed = data[full_prop];
                          match.twoD[prop] = _.times(packed.shape[0], function (i) {
                            return that.slice(packed.array, i * packed.shape[1], (i + 1) * packed.shape[1]);
                          });
                        }
                      }
                    }
                    //TODO MERGE TO NEIGHBOURS?
                } else {
                    //We didn't get data so remove this interval
                    that.intervals = that.intervals.filter(function (i) {
                        return i !== match;
                    });
                }
                that.update_callback();
            };

            that.init(col_ordinal, provider, update_callback);
            return that
        };
    }
);