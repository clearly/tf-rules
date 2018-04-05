const co = require('co');
const Papa = require('papaparse');
const {NonCompliantResource, RuleResult} = require('../../../rule-result');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const CloudWatchMetricAlarms = {};

CloudWatchMetricAlarms.uuid = "2681139d-4660-4518-a847-0320eb8593e9";
CloudWatchMetricAlarms.groupName = "CloudWatch";
CloudWatchMetricAlarms.tags = ["CIS | 1.1.0 | 3.1"];
CloudWatchMetricAlarms.config_triggers = ["AWS::CloudWatch::Alarm"];
CloudWatchMetricAlarms.paths = {LogMetricFilterAndAlarmExistForUnauthorizedAPICalls: "aws_cloudwatch_metric_alarm"};
CloudWatchMetricAlarms.docs = {
    description: 'A log metric filter and alarm exist for all rules.',
    recommended: true
};
CloudWatchMetricAlarms.schema = {
    type: 'object',
    properties: {
        UnauthorizedAPICalls: {type: 'boolean'},
        ManagementConsoleSignInWithoutMFA: {type: 'boolean'},
        UsageOfRootAccount: {type: 'boolean'},
        IAMPolicyChanges: {type: 'boolean'},
        CloudTrailConfigurationChanges: {type: 'boolean'},
        AWSManagementConsoleAuthenticationFailures: {type: 'boolean'},
        DisablingOrScheduledDeletionOfCustomerCreatedCMKs: {type: 'boolean'},
        S3BucketPolicyChanges: {type: 'boolean'},
        AWSConfigConfigurationChanges: {type: 'boolean'},
        SecurityGroupChanges: {type: 'boolean'},
        ChangesToNetworkAccessControlLists: {type: 'boolean'},
        ChangesToNetworkGateways: {type: 'boolean'},
        RouteTableChanges: {type: 'boolean'},
        VPCChanges: {type: 'boolean'}
    }
};

const filterPatterns = [
    {
        rule: 'unauthorized API calls',
        pattern: '{ ($.errorCode = "*UnauthorizedOperation") || ($.errorCode = "AccessDenied*") }'
    },
    {
        rule: 'management console sign-in without MFA',
        pattern: '{ ($.eventName = "ConsoleLogin") && ($.additionalEventData.MFAUsed != "Yes") }'
    },
    {
        rule: 'usage of root account',
        pattern: '{ ($.userIdentity.type = "Root") && ($.userIdentity.invokedBy NOTEXISTS) && ($.eventType != "AwsServiceEvent") }'
    },
    {
        rule: 'IAM policy changes',
        pattern: '{ ($.eventName = DeleteGroupPolicy) || ($.eventName = DeleteRolePolicy) || ($.eventName = DeleteUserPolicy) || ($.eventName = PutGroupPolicy) || ($.eventName = PutRolePolicy) || ($.eventName = PutUserPolicy) || ($.eventName = CreatePolicy) || ($.eventName = DeletePolicy) || ($.eventName = CreatePolicyVersion) || ($.eventName = DeletePolicyVersion) || ($.eventName = AttachRolePolicy) || ($.eventName = DetachRolePolicy) || ($.eventName = AttachUserPolicy) || ($.eventName = DetachUserPolicy) || ($.eventName = AttachGroupPolicy) || ($.eventName = DetachGroupPolicy) }'
    },
    {
        rule: 'CloudTrail configuration changes',
        pattern: '{ ($.eventName = CreateTrail) || ($.eventName = UpdateTrail) ||($.eventName = DeleteTrail) || ($.eventName = StartLogging) || ($.eventName = StopLogging) }'
    },
    {
        rule: 'AWS management console authentication failures',
        pattern: '{ ($.eventName = ConsoleLogin) && ($.errorMessage = "Failedauthentication") }'
    },
    {
        rule: 'disabling or scheduled deletion of customer created CMKs',
        pattern: '{ ($.eventSource = kms.amazonaws.com) && (($.eventName = DisableKey) || ($.eventName = ScheduleKeyDeletion)) }'
    },
    {
        rule: 'S3 bucket policy changes',
        pattern: '{ ($.eventSource = s3.amazonaws.com) && (($.eventName = PutBucketAcl) || ($.eventName = PutBucketPolicy) || ($.eventName = PutBucketCors) || ($.eventName = PutBucketLifecycle) || ($.eventName = PutBucketReplication) || ($.eventName = DeleteBucketPolicy) || ($.eventName = DeleteBucketCors) || ($.eventName = DeleteBucketLifecycle) || ($.eventName = DeleteBucketReplication)) }'
    },
    {
        rule: 'AWS Config configuration changes',
        pattern: '{ ($.eventSource = config.amazonaws.com) && (($.eventName = StopConfigurationRecorder) || ($.eventName = DeleteDeliveryChannel) || ($.eventName = PutDeliveryChannel) || ($.eventName = PutConfigurationRecorder)) }'
    },
    {
        rule: 'security group changes',
        pattern: '{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) || ($.eventName = CreateSecurityGroup) || ($.eventName = DeleteSecurityGroup) }'
    },
    {
        rule: 'changes to Network Access Control Lists',
        pattern: '{ ($.eventName = CreateNetworkAcl) || ($.eventName = CreateNetworkAclEntry) || ($.eventName = DeleteNetworkAcl) || ($.eventName = DeleteNetworkAclEntry) || ($.eventName = ReplaceNetworkAclEntry) || ($.eventName = ReplaceNetworkAclAssociation) }'
    },
    {
        rule: 'changes to network gateways',
        pattern: '{ ($.eventName = CreateCustomerGateway) || ($.eventName = DeleteCustomerGateway) || ($.eventName = AttachInternetGateway) || ($.eventName = CreateInternetGateway) || ($.eventName = DeleteInternetGateway) || ($.eventName = DetachInternetGateway) }'
    },
    {
        rule: 'route table changes',
        pattern: '{ ($.eventName = CreateRoute) || ($.eventName = CreateRouteTable) || ($.eventName = ReplaceRoute) || ($.eventName = ReplaceRouteTableAssociation) || ($.eventName = DeleteRouteTable) || ($.eventName = DeleteRoute) || ($.eventName = DisassociateRouteTable) }'
    },
    {
        rule: 'VPC changes',
        pattern: '{ ($.eventName = CreateVpc) || ($.eventName = DeleteVpc) || ($.eventName = ModifyVpcAttribute) || ($.eventName = AcceptVpcPeeringConnection) || ($.eventName = CreateVpcPeeringConnection) || ($.eventName = DeleteVpcPeeringConnection) || ($.eventName = RejectVpcPeeringConnection) || ($.eventName = AttachClassicLinkVpc) || ($.eventName = DetachClassicLinkVpc) || ($.eventName = DisableVpcClassicLink) || ($.eventName = EnableVpcClassicLink) }'
    },
];


CloudWatchMetricAlarms.livecheck = co.wrap(function* (context) {
    let {config, provider} = context;
    let trail = new provider.CloudTrail();
    let logs = new provider.CloudWatchLogs();
    let watch = new provider.CloudWatch();
    let sns = new provider.SNS();

    let noncompliant_resources = [];

    // Get the names of all the CloudTrail log groups
    let trails = yield trail.describeTrails().promise();
    let logGroupArns = trails.trailList.map(x => x.CloudWatchLogsLogGroupArn);

    let logGroupNames = [];
    logGroupArns.map(x => {
        logGroupNames.push(x.substring(46, x.length - 2))
    });

    // Get all the metric filters in those log groups
    let promises = [];
    logGroupNames.map(x => {
        promises.push(logs.describeMetricFilters({logGroupName: x}).promise());
    });
    let metricFilters = yield Promise.all(promises);

    // Get the names of all the metric filters that match a rule pattern
    let patterns = filterPatterns.map(x => x.pattern);
    let metrics = metricFilters[0].metricFilters.filter(x => patterns.includes(x.filterPattern));
    let metricNames = metrics.map(x => x.metricTransformations[0].metricName);

    // Get all the alarms under those metric filters
    let result = yield watch.describeAlarms().promise();
    let alarms = result.MetricAlarms;
    while (result.NextToken) {
        result = yield watch.describeAlarms({NextToken: result.NextToken}).promise();
        alarms = [...alarms, ...result.MetricAlarms]
    }

    // Check if no metric filters exist
    if (metrics.length === 0) {
        noncompliant_resources.push(new NonCompliantResource({
            resource_id: "CloudWatchLogs",
            resource_type: "AWS::CloudWatch::Alarm",
            message: "does not have any metric filters set up."
        }));
        return new RuleResult({
            valid: "fail",
            message: `A log metric filter and alarm do not exist for any rules.`,
            noncompliant_resources
        })
    }

    // filterPatterns.forEach(pattern => {
    for (let i = 0; i < filterPatterns.length; i++) {

        // metricNames.forEach(name => {
        for (let j = 0; j < metricNames.length; j++) {


            let activeFilter = metricFilters[0].metricFilters.find(x => x.filterPattern === filterPatterns[i].pattern);
            let filteredAlarm = undefined;
            let topicArn = undefined;
            let subscribers = undefined;

            if (alarms) {
                filteredAlarm = alarms.find(x => x.MetricName === metricNames[j]);
            }
            if (filteredAlarm) {
                topicArn = filteredAlarm.AlarmActions[0];
            }
            if (topicArn) {
                subscribers = yield sns.listSubscriptionsByTopic({TopicArn: topicArn}).promise();
            }


            // Check if no metric filters exist for the specified rule
            if (activeFilter === undefined) {
                noncompliant_resources.push(new NonCompliantResource({
                    resource_id: "CloudWatch",
                    resource_type: "AWS::CloudWatch::Alarm",
                    message: `does not have a metric filter set up for ${filterPatterns[i].rule}.`
                }));
            }

            // Check if no alarms exist for the specified filter
            else if (filteredAlarm === undefined) {
                noncompliant_resources.push(new NonCompliantResource({
                    resource_id: "CloudWatch",
                    resource_type: "AWS::CloudWatch::Alarm",
                    message: `does not have an alarm set up for ${filterPatterns[i].rule}.`
                }));
            }

            // Check if no actions exist for the specified alarm
            else if (filteredAlarm.AlarmActions.length === 0) {
                noncompliant_resources.push(new NonCompliantResource({
                    resource_id: "CloudWatch",
                    resource_type: "AWS::CloudWatch::Alarm",
                    message: `does not have an action linked to the alarm for ${filterPatterns[i].rule}.`
                }));
            }

            // Check if no subscriptions exist for the specified alarm
            else if (subscribers.Subscriptions.length === 0) {
                noncompliant_resources.push(new NonCompliantResource({
                    resource_id: "CloudWatch",
                    resource_type: "AWS::CloudWatch::Alarm",
                    message: `does not have any subscribers linked to the alarm for ${filterPatterns[i].rule}.`
                }));
            }
        }
    }

    if (noncompliant_resources.length > 0) {
        return new RuleResult({
            valid: "fail",
            message: `A log metric filter and alarm do not exist for one or more rules.`,
            noncompliant_resources
        })
    }
    else {
        return new RuleResult({
            valid: "success"
        })
    }
});

module.exports = CloudWatchMetricAlarms;