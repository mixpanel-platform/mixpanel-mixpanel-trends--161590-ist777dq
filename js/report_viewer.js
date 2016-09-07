/* global DateRange, RelativeDate */

_.namespace("mp.marketing.trends", function(ns) {
    'use strict';

    ns.ReportViewer = Backbone.TemplateView.extend({
        className: "report_viewer",

        templates: {
            'base': '#data_view',
            'dropdown_report_item': '#dropdown_report_item',
            'promo': '#report_promo'
        },

        initialize: function() {
            // create a session object for each viewer instance.
            // this is to store session state that is not global but
            // shared between the graph, table, and conversion graph
            ns.session.data = new Backbone.Model();
            ns.session.trigger('create:data');

            ns.session.data.on('change', this.serialize_params, this);
            ns.session.on('change:report', this.load_report, this);

            this.api = new ns.TrendsApi();

            this.on_close(function() {
                // close widgets
                this.date_picker.remove();
                if (this.current_report) { this.current_report.close(); }

                // unbind data
                ns.session.off(null, null, this);

                // clear our session object
                ns.session.data.off();
                ns.session.data = null;

                this.$('.report_dropdown_label').off();
                mp.utility.unbind_outside_event('click', 'trends_report_dropdown');
                this.off(null, null, this);
            });

            this.load_report();
            this.render();

            this.on('ready', function () {
                this.current_report.trigger('ready');
            }, this);
        },

        render: function() {
            this.render_base_template();
            this.render_report_dropdown();
            this.render_date_picker();
            this.$('.report_render_target').html(this.current_report.el);

            if (this.current_report.asterisk) {
                this.$('.report_asterisk').text(this.current_report.asterisk);
            }
        },

        render_report_dropdown: function() {
            this.$('.report_dropdown_label').off('click');
            this.$('.report_dropdown_label').on('click', _.bind(function(e) {
                this.$('.report_dropdown').show();
                this.$('.report_dropdown').css('left', this.$('.report_dropdown_arrow').position().left - 150 + 'px');
                e.stopPropagation();
            }, this));

            mp.utility.bind_outside_event('click', 'trends_report_dropdown', this.$('.report_dropdown'), function(e) {
                this.$('.report_dropdown').hide();
            }, this);

            var menu = _.sortBy(ns.reports, 'order');
            _.each(menu, function(report) {
                var report_elem = $(this.render_template('dropdown_report_item', {
                    'title': report.nice_name,
                    'description': report.description,
                    'chart_type': report.chart_type
                }));
                report_elem.on('click', function() {
                    ns.router.goto_report(report.slug);
                });
                this.$('.report_dropdown_body').append(report_elem);
            }, this);

            var report_slug = ns.session.get('report');
            var report = _.find(ns.reports, function(r) { return r.slug === report_slug; });
            this.$('.report_dropdown_title').text(report.nice_name);
        },

        render_date_picker: function() {
            this.date_picker = new mp.widgets.DatePicker().create(
                this.$('.date_picker'),
                [ ], {
                    'min_date': new Date(2013, 1, 5)
                }
            );

            this._update_date_picker();
            this.date_picker.onchange(_.bind(function(date_range) {
                ns.session.data.set('date_range', date_range);
            }, this));

            ns.session.data.on('change:date_range', this._update_date_picker, this);
            ns.session.data.on('change:date_range', this._update_stats, this);
        },

        _update_date_picker: function() {
            var range = ns.session.data.get('date_range');
            if (range) {
                this.date_picker.set_dates(range, true);
            }
        },

        _update_stats: function(m, date_range) {
            if (!date_range) { return; }

            var params = {
                'query_name': 'update_stats',
                'from_date': date_range.from().toString(mp.utility.default_date_format),
                'to_date': date_range.to().toString(mp.utility.default_date_format),
                'unit': 'day'
            };

            this.api.query(params, _.bind(function(data) {
                if (data.error) {
                    this.$('.data_view_footer').hide();
                } else {
                    var count = _.reduce(data.data.values.Action, function(m, c) { return m + c; }, 0);
                    this.$('.data_view_footer').show().find('.r_num').text(_.numberFormat(count, 0));
                }
            }, this));
        },

        load_report: function() {
            var report_slug = ns.session.get('report');
            if (!report_slug) { return; }

            var Report = _.find(ns.reports, function(r) { return r.slug === report_slug; });
            this.time_units = Report.time_units;

            if (this.current_report) { this.current_report.close(); }
            this.current_report = new Report({
                session: ns.session.data,
                api: this.api,
                legend_type: Report.legend_type,
                color_scheme: Report.color_scheme,
                asterisk: Report.asterisk
            });

            var defaults = this.current_report.get_defaults();
            var resets = _.extend({}, defaults, ns.session.data.attributes);
            ns.session.data.set(resets);

            this._update_stats(ns.session.data, ns.session.data.get('date_range'));

            mixpanel.marketing_trends.track('Viewed Report', {'report': report_slug});
        },

        update_params: function(params) {
            if (!_.isUndefined(params.from_date) && !_.isUndefined(params.to_date)) {
                params.date_range = new DateRange(
                    new RelativeDate(params.from_date),
                    new RelativeDate(params.to_date)
                );
                delete params.from_date; delete params.to_date;
            }

            ns.session.data.set(params);
        },

        serialize_params: function() {
            var params = {};

            if (ns.session.data.has('date_range')) {
                params.from_date = ns.session.data.get('date_range').relative_from();
                params.to_date = ns.session.data.get('date_range').relative_to();
            }

            if (ns.session.data.has('report_unit')) {
                params.report_unit = ns.session.data.get('report_unit');
            }

            this.trigger('serialize_params', 'report/' + ns.session.get('report'), params);
        }
    });
});
