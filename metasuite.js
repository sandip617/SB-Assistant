// SB never posts to the Facebook Page. This only spots a request to post, so SB can say so instead of pretending. (Reviews are routed before this.)
const wantsFbPost = q => /facebook|ফেসবুক|\bfb\b|পেজ|\bpage\b/i.test(q) && /পোস্ট|\bpost\b|আপলোড|\bupload\b|শিডিউল|\bschedule\b/i.test(q);
module.exports = { wantsFbPost };
