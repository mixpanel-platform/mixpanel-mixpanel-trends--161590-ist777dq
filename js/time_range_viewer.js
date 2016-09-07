/* globals DateRange, RelativeDate */

_.namespace('mp.marketing.trends', function(ns) {
    'use strict';

    var hours_label = 'Past 96 hours',
        days_label = 'Past 30 days',
        weeks_label = 'Past 10 weeks',
        months_label = 'Past 12 months';

    var all_unit_configs = [
        { name: 'hour',  default_range: new DateRange(new RelativeDate(-3), new Date(), hours_label) },
        { name: 'day',   default_range: new DateRange(new RelativeDate(-30 + 1), new Date(), days_label) },
        { name: 'week',  default_range: new DateRange(new RelativeDate(-7 * 10), new Date(), weeks_label) },
        { name: 'month', default_range: new DateRange(new RelativeDate(-365), new Date(), months_label) }
    ];

    ns.TimeRangeViewer = ns.ReportViewer.extend({
        render_date_picker: function() {
            this.session = ns.session.data;

            this.time_units = this.time_units || ['hour', 'day'];
            this.unit_configs = _.filter(all_unit_configs, function (unit_config) {
                return _.contains(this.time_units, unit_config.name);
            }, this);

            this.date_picker = new mp.widgets.DatePicker().create(
                this.$('.date_picker'),
                _.pluck(this.unit_configs, 'default_range')
            );

            this.date_unit_toggle = new mp.widgets.Toggle().create(
                this.$('.date_unit_toggle'),
                _.map(this.unit_configs, function (unit_config) {
                    var name = unit_config.name;
                    return [ name, name.charAt(0).toUpperCase() + name.substring(1) ];
                }),
                { selected: this.session.get('report_unit') }
            );

            this.date_picker.onchange(_.bind(function(date_range) {
                var params = { 'date_range': date_range };

                switch (date_range.label()) {
                case hours_label:
                    params.report_unit = 'hour'; break;
                case days_label:
                    params.report_unit = 'day'; break;
                case weeks_label:
                    params.report_unit = 'week'; break;
                case months_label:
                    params.report_unit = 'month'; break;
                }

                this._set_session(params);
            }, this));

            this.date_unit_toggle.container.change(_.bind(function(e) {
                this._set_session({ 'report_unit': this.date_unit_toggle.value });
            }, this));

            this.on('ready', _.bind(function () {
                this._update_date_unit_toggle();
                this._update_date_picker();
                this.date_picker.collapse();

                this.session.on('change:date_range', this._update_date_picker, this);
                this.session.on('change:report_unit', this._update_date_unit_toggle, this);
                this.session.on('change:date_range', this._update_stats, this);
            }, this));
        },

        _update_date_unit_toggle: function () {
            this.date_unit_toggle.set_selected(this.session.get('report_unit'));
        },

        update_params: function (params) {
            if (!_.isUndefined(params.from_date) && !_.isUndefined(params.to_date)) {
                if (params.from_date === 0) {
                    // This is a hack to prevent an edge case. If it's the next day in UTC but the previous day in PST
                    // it will show no data points at all if from_date is 0
                    params.from_date = -1;
                }

                params.date_range = new DateRange(
                    new RelativeDate(params.from_date),
                    new RelativeDate(params.to_date)
                );
                delete params.from_date; delete params.to_date;
            }
            this._set_session(params);
        },

        // Validate parameters before saving to session
        //  - if date range is being set to > 4 days with unit=hour, switch to unit=day
        //  - if unit is being set to hour with date range > 4 days, truncate date range to 4 days
        //  - if unit is being set to week with date range < 7 days, increase date range to 7 days
        //  - if unit is being set to month with date range < 31 days, increase date range to 31 days
        _set_session: function (params) {
            var date_range = params.date_range || this.session.get('date_range'),
                report_unit = params.report_unit || this.session.get('report_unit'),
                to, from;

            if (params.date_range && params.date_range.days() > 4 && report_unit === 'hour') {
                params.report_unit = 'day';
            }

            if (params.report_unit === 'hour' && date_range.days() > 4) {
                to = date_range.to();
                from = new Date(to).add(-3).days();
                params.date_range = new DateRange(from, to);
            }

            if (report_unit === 'week' && date_range.days() < 7) {
                to = date_range.to();
                from = new Date(to).add(-7).days();
                params.date_range = new DateRange(from, to);
            }

            if (report_unit === 'month' && date_range.days() < 31) {
                to = date_range.to();
                from = new Date(to).add(-31).days();
                params.date_range = new DateRange(from, to);
            }

            this.session.set(params);
        }
    });
});
