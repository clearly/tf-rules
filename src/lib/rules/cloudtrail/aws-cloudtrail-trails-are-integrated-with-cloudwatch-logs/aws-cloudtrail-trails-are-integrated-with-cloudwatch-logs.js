const co = require('co');
const Papa = require('papaparse');
const {NonCompliantResource, RuleResult} = require('../../../rule-result');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const CloudTrailTrailsAreIntegratedWithCloudWatchLogs = {};

CloudTrailTrailsAreIntegratedWithCloudWatchLogs.uuid = "f030c67a-48b2-4499-bbec-c14c7798e8a0";
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.groupName = "CloudTrail";
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.tags = ["CIS | 1.1.0 | 2.4"];
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.config_triggers = ["AWS::CloudTrail::Trail"];
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.paths = {CloudTrailTrailsAreIntegratedWithCloudWatchLogs: "aws_cloudtrail"};
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.docs = {
    description: 'All CloudTrail trails are integrated with CloudWatch logs.',
    recommended: true
};
CloudTrailTrailsAreIntegratedWithCloudWatchLogs.schema = {type: 'boolean'};


CloudTrailTrailsAreIntegratedWithCloudWatchLogs.livecheck = co.wrap(function* (context) {
    let {config, provider} = context;
    let trail = new provider.CloudTrail();

    let trails = yield trail.describeTrails().promise();
    let noncompliant_resources = [];
    let promises = [];

    trails.trailList.map(tr => {
        promises.push(trail.getTrailStatus({Name: tr.Name}).promise());
    });

    let status = yield Promise.all(promises);

    trails.trailList.map(tr => {
        status.map(x => {
            let latestDate = new Date(x.LatestCloudWatchLogsDeliveryTime);
            let today = new Date();
            if ((today - latestDate) > 86400000) {
                noncompliant_resources.push(tr)
            }
        })
    });

    if (noncompliant_resources.length > 0) {
        return new RuleResult({
            valid: "fail",
            message: "One or more CloudTrail trails are not integrated with CloudWatch logs.",
            noncompliant_resources: noncompliant_resources.map(x => new NonCompliantResource({
                resource_id: x.Name,
                resource_type: "AWS::CloudTrail::Trail",
                message: "is not integrated with CloudWatch logs."
            }))
        })
    }
    else return new RuleResult({
        valid: "success"
    })
});

module.exports = CloudTrailTrailsAreIntegratedWithCloudWatchLogs;