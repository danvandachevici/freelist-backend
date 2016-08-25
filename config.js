module.exports = {
	documentRoot: __dirname + "/dev/",
	serverPort: 26016,
	mongo: [
		{
			path: "mongo.vandachevici.ro:27017/freelist",
			name: "freelist",
			username: "freelist",
			password: "carapace",
			collections: {
				users: 			"users",
				tokens: 		"tokens",
				list_details: 	"list_details",
				lists: 			"lists"
			}
		}
	]
}