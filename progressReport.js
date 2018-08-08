
/**
 * Gets user list for progress reports 
 * 
 * @return String[] of usernames 
 */
function getUserListForProgressReports() {
    //get yesterday
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    //4 weeks before yesterday
    var fourWeeksBeforeYesterday = new Date();
    fourWeeksBeforeYesterday.setDate(yesterday.getDate() - 28);

    //data for progress report user API query
    var progressReportUserParams = 
    {
        program_id: "1", 
        start_date: fourWeeksBeforeYesterday, 
        end_date: yesterday, 
        user_role:""
    };

    //data for all user list API query
    var allUserListParams = 
    {
        namePrefix: "",       
        operator: "joey",             
        reportDate: new Date(),        
        userRole: "all",             
        userHasEmail: 1           
  
    }

    var progressReportUsers = [];
    var allUsers = new Set();

    $.when(
        //query the API to get list of all users
        $.ajax({
            url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/getUsers",
            type:"POST",
            data:JSON.stringify(allUserListParams),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: function(response){
                console.log('all users is: ', response);
                for (let i = 0; i < response.length; i++) {
                    if (response[i].role === "student" || response[i].role === "super-student") {
                        allUsers.add(response[i].userName);
                    }
                }
            }
        }),

        //query the API using proxy server to bypass CORS and get list of users for progress report
        $.ajax({
            url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/getalluseractivities4admin",
            type:"POST",
            data:JSON.stringify(progressReportUserParams),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: function(response){
                console.log('progress report users is: ', response);
                for (let i = 0; i < response.length; i++) {
                    //Make sure username at least makes sense 
                    if (response[i].username.indexOf(".") === -1) {
                        continue;
                    }
                    //otherwise
                    progressReportUsers.push(response[i].username);
                }
            }
        })
    ).done(function(response1,response2) {
        console.log('Both ajax calls done, preparing final arr');
        //Iterate through progress report users and check if the user is 'student' or 'super-student'
        //If so, add it to the final array of users which will serve as the list of students
        //to send progress reports to.
        var finalArr = [];
        for (let i = 0; i < progressReportUsers.length; i++) {
            if(allUsers.has(progressReportUsers[i])) {
                finalArr.push(progressReportUsers[i]);
            }
        }

        console.log('Done, final array is: ', finalArr);

        var nextNames = [];
        var added = 10;
        var sendReportParam = 
        {
            createdBy: "joey", 
            createdDate: new Date(),
            users: []
        };

        for (let i = 0; i < finalArr.length; ) {

            //Add 10 users to send list, otherwise add remaining users
            if (finalArr.length - i >= 10) {
                for (let j = 0; j < 10; j++) {
                    nextNames = finalArr.pop();
                }
                i += 10;
            }
            else {
                for (let j = 0; j < finalArr.length - i; j++) {
                    nextNames = finalArr.pop();
                }
                i = finalArr.length;
            }

            sendReportParam.users = nextNames;


            $.ajax({
                url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/sendProgressReportToUsers",
                type:"POST",
                data:JSON.stringify(sendReportParam),
                contentType:"application/json; charset=utf-8";
                dataType:"json",
                async:false,
                success: function(response){
                    console.log(response);
                    console.log('successfully sent progress reports to ' + sendReportParam);
                }
            });
            nextNames = [];
        }

    })
    .fail(function(err) {
        console.log(err);
    })

}

async function getUserListForBoardsSequential(maxGrade) {
    const lastGrade = maxGrade;
    var gradeData = [];

    var boardParams = {
        learning_center_id: "All",
        grade: "2"
    }

    for (let i = 2; i <= maxGrade; i++) {
        boardParams.grade = i.toString();
        // wait for the promise to resolve before advancing the for loop
        await $.when(
                //query the API to get list of all users
                $.ajax({
                    url: "https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/userCompletionReport5",
                    type: "POST",
                    data: JSON.stringify(boardParams),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    success: function(response) {
                        console.log('board data is: ', response);
                    }
                })
            ).done(function(response1) {
                console.log('Got response for grade: ', i);
                gradeData.push(response1);

            })
            .fail(function(err) {
                console.log(err);
            })
    }

    return gradeData;
}



function getUserListForBoards(maxGrade) {

    var gradeData = [];    
    var boardParams = {
        learning_center_id: "All",
        grade: "2"
    }



    for (let i = 2; i <= maxGrade; i++) {
        boardParams.grade = i.toString();
        
    }

    console.log('finished: ', gradeData);
    /*$.when(
        //query the API to get list of all users
        $.ajax({
            url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/userCompletionReport5",
            type:"POST",
            data:JSON.stringify(boardParams),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: function(response){
                console.log('board data is: ', response);
            }
        })
    ).done(function(response1) {
        console.log('Done');
        theData = response1;

    })
    .fail(function(err) {
        console.log(err);
    })*/

}

/*


var boardParams = {
    learning_center_id: "All",
    grade: "2"
}

var q = angular.element($0).injector().get('$q');
var fac = angular.element($0).injector().get('CourseCompletionFactory');

myScope.refresh = function() {
        if (myScope.learningCenter && myScope.grade) {
            var params = {
                learning_center_id: myScope.learningCenter,
                grade: myScope.grade
            };
            $scope.showWait(),
            $q.all([CourseCompletionFactory.apiProxy(params, "userCompletionReport5")]).then(function(response) {
                if (response[0].data.length > 0) {
                    for (var gridData = response[0].data, i = 0; i < gridData.length; i++)
                        for (var row = gridData[i], j = 2; j < 12; j++) {
                            var cellValue = row["grade_" + j];
                            row["grade_" + j] = "number" == typeof cellValue ? {
                                value: cellValue,
                                color: "blue"
                            } : {
                                value: cellValue,
                                color: "green"
                            }
                        }
                    $scope.dataTable.data = gridData
                } else
                    console.log("No course completion reports available");
                $scope.hideWait()
            })
        }
    }

 */





/*
-------------
//get yesterday
var yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

//4 weeks before yesterday
var fourWeeksBeforeYesterday = new Date();
fourWeeksBeforeYesterday.setDate(yesterday.getDate() - 28);

//data for api query
var params = {program_id: "1", start_date: yesterday, end_date: fourWeeksBeforeYesterday, user_role:""};

var userSet = new Set();

//query the API using proxy server to bypass CORS
    $.ajax({
      url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/getalluseractivities4admin",
      type:"POST",
      data:JSON.stringify(params),
      contentType:"application/json; charset=utf-8",
      dataType:"json",
      success: function(response){
        for (int i = 0; i < response.length; i++) {
    
        }
      }
    })

--------------


api call:
notes: NEED JSON.stringify; otherwise, use $http or equivalent
NEED to create Date object from a specific date range, then use that data for start_date and end_date of params

var startDate = new Date("Tue Jul 10 2018 00:00:00 GMT-0700 (Pacific Daylight Time)");
var params = {program_id: "1", start_date: "", end_date: "", user_role: ""}
params.start_date = startDate;
params.end_date = startDate;

--------API CALL FOR GET USER LIST-------
    $.ajax({
      url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/getalluseractivities4admin",
      type:"POST",
      data:JSON.stringify(params),
      contentType:"application/json; charset=utf-8",
      dataType:"json",
      success: function(response){
        console.log(response);
      }
    })
-------------------

this returns array of objects like so:
{
username: "first.last",
school_grade: int, 
grade_activity_list: arr of grade_activity obj*,
current_grade: int,
user_id: str
}

for object array:
- make sure that object fits criteria of real username (first.last)
- if so, add to map with key:value as "username": "user_id" (perhaps reverse)
- 
grade_activity object:
{
    school_grade: str, ex: "7"
    score_change: str, ex: "+12.67"
    score: double, ex: 82.16
    used_time: int, ex: 8877
}





var myScope = angular.element($0).scope();
var reportFunc = myScope.generateAdminUserDailyReport;
var myQ = angular.element($0).injector().get('$q');
var myFac = angular.element($0).injector().get('SkillStatisticsModelFactory');


myScope.reportFunc = function() {
        if (myScope.waitingAdminSearch = !0,
        "All Students" == myScope.reportobj.selectedPrfeix) {
            var userRole = "";
            "All Admins" == myScope.reportobj.selectedPrfeix ? userRole = "admin" : "All Trial Accounts" == myScope.reportobj.selectedPrfeix && (userRole = "trial");
            var params = {
                program_id: "1",
                start_date: myScope.adminTimeObj.start_date,
                end_date: myScope.adminTimeObj.end_date,
                user_role: userRole
            };
            console.log('***params are: ', params, ' *****');
            myQ.all([myFac.getAllUserActivities4Admin(params)]).then(function(response) {
                myScope.adminUserActivityCollection = response[0].data,
                console.log("LLLLLLL ===== myScope.adminUserActivityCollection:  ", myScope.adminUserActivityCollection);
                var allUserActivityList = [];
                myScope.totalUserRecordCount = myScope.adminUserActivityCollection.length,
                myScope.totalUserGradeCount = 0,
                myScope.allUserTime = 0,
                myScope.allUserScoreChange = 0,
                myScope.allUserAtLearningCenter = 0;
                for (var i = 0; i < myScope.adminUserActivityCollection.length; i++) {
                    var grade_list = myScope.adminUserActivityCollection[i].grade_activity_list
                      , curr_user_at_center = !1;
                    if (void 0 !== grade_list && grade_list.length > 0)
                        for (var j = 0; j < grade_list.length; j++) {
                            myScope.totalUserGradeCount += 1;
                            var userObj = {
                                user_name: myScope.adminUserActivityCollection[i].username,
                                grade_id: grade_list[j].grade_id,
                                used_time: grade_list[j].used_time,
                                score: grade_list[j].score,
                                score_change: grade_list[j].score_change,
                                user_id: myScope.adminUserActivityCollection[i].user_id,
                                at_learning_center: grade_list[j].at_learning_center,
                                school_grade: grade_list[j].school_grade,
                                current_grade: grade_list[j].current_grade
                            };
                            1 == grade_list[j].at_learning_center ? (userObj.at_learning_center = 1,
                            curr_user_at_center = !0) : userObj.at_learning_center = 0,
                            allUserActivityList.push(userObj),
                            myScope.allUserTime += userObj.used_time;
                            var tmp = parseFloat(myScope.getValueOfScoreChange(userObj.score_change));
                            myScope.allUserScoreChange += tmp
                        }
                    1 == curr_user_at_center && (myScope.allUserAtLearningCenter += 1)
                }
                console.log("LLLLLLLLLL ====== allUserActivityList", allUserActivityList),
                myScope.gridOptionsAdminAllUserActivity.data = allUserActivityList,
                myScope.allUserTime = myScope.convertSecToString($scope.allUserTime),
                myScope.allUserScoreChange = Math.round(100 * myScope.allUserScoreChange) / 100,
                $scope.showAllUserCount = !0,
                $scope.waitingAdminSearch = !1
            }, function(err) {
                console.log(" ERROR While getting getAllUserActivities4Admin -- all user  ", err),
                $scope.waitingAdminSearch = !1
            })
        } else {
            var sparams = {
                program_id: "1",
                user_id: myScope.reportobj.useridchoosed,
                start_date: myScope.adminTimeObj.start_date,
                end_date: myScope.adminTimeObj.end_date
            };
            myQ.all([myFac.getUserActivity4Report(sparams)]).then(function(response) {
                myScope.adminUserActivityCollection = response[0].data,
                console.log("LLLLLLL ===== myScope.adminUserActivityCollection:  ", myScope.adminUserActivityCollection),
                myScope.gridOptionsAdminSingleUserActivity.data = myScope.adminUserActivityCollection,
                myScope.waitingAdminSearch = !1
            }, function(err) {
                console.log(" ERROR While getting generateAdminUserDailyReport -- single user  ", err),
                myScope.waitingAdminSearch = !1
            })
        }
    }

*/
$scope.generateAdminUserDailyReport = function() {
        if ($scope.waitingAdminSearch = !0,
        "All Students" == $scope.reportobj.selectedPrfeix) {
            var userRole = "";
            "All Admins" == $scope.reportobj.selectedPrfeix ? userRole = "admin" : "All Trial Accounts" == $scope.reportobj.selectedPrfeix && (userRole = "trial");
            var params = {
                program_id: "1",
                start_date: $scope.adminTimeObj.start_date,
                end_date: $scope.adminTimeObj.end_date,
                user_role: userRole
            };
            $q.all([SkillStatisticsModelFactory.getAllUserActivities4Admin(params)]).then(function(response) {
                $scope.adminUserActivityCollection = response[0].data,
                console.log("LLLLLLL ===== $scope.adminUserActivityCollection:  ", $scope.adminUserActivityCollection);
                var allUserActivityList = [];
                $scope.totalUserRecordCount = $scope.adminUserActivityCollection.length,
                $scope.totalUserGradeCount = 0,
                $scope.allUserTime = 0,
                $scope.allUserScoreChange = 0,
                $scope.allUserAtLearningCenter = 0;
                for (var i = 0; i < $scope.adminUserActivityCollection.length; i++) {
                    var grade_list = $scope.adminUserActivityCollection[i].grade_activity_list
                      , curr_user_at_center = !1;
                    if (void 0 !== grade_list && grade_list.length > 0)
                        for (var j = 0; j < grade_list.length; j++) {
                            $scope.totalUserGradeCount += 1;
                            var userObj = {
                                user_name: $scope.adminUserActivityCollection[i].username,
                                grade_id: grade_list[j].grade_id,
                                used_time: grade_list[j].used_time,
                                score: grade_list[j].score,
                                score_change: grade_list[j].score_change,
                                user_id: $scope.adminUserActivityCollection[i].user_id,
                                at_learning_center: grade_list[j].at_learning_center,
                                school_grade: grade_list[j].school_grade,
                                current_grade: grade_list[j].current_grade
                            };
                            1 == grade_list[j].at_learning_center ? (userObj.at_learning_center = 1,
                            curr_user_at_center = !0) : userObj.at_learning_center = 0,
                            allUserActivityList.push(userObj),
                            $scope.allUserTime += userObj.used_time;
                            var tmp = parseFloat($scope.getValueOfScoreChange(userObj.score_change));
                            $scope.allUserScoreChange += tmp
                        }
                    1 == curr_user_at_center && ($scope.allUserAtLearningCenter += 1)
                }
                console.log("LLLLLLLLLL ====== allUserActivityList", allUserActivityList),
                $scope.gridOptionsAdminAllUserActivity.data = allUserActivityList,
                $scope.allUserTime = $scope.convertSecToString($scope.allUserTime),
                $scope.allUserScoreChange = Math.round(100 * $scope.allUserScoreChange) / 100,
                $scope.showAllUserCount = !0,
                $scope.waitingAdminSearch = !1
            }, function(err) {
                console.log(" ERROR While getting getAllUserActivities4Admin -- all user  ", err),
                $scope.waitingAdminSearch = !1
            })
        } else {
            var sparams = {
                program_id: "1",
                user_id: $scope.reportobj.useridchoosed,
                start_date: $scope.adminTimeObj.start_date,
                end_date: $scope.adminTimeObj.end_date
            };
            $q.all([SkillStatisticsModelFactory.getUserActivity4Report(sparams)]).then(function(response) {
                $scope.adminUserActivityCollection = response[0].data,
                console.log("LLLLLLL ===== $scope.adminUserActivityCollection:  ", $scope.adminUserActivityCollection),
                $scope.gridOptionsAdminSingleUserActivity.data = $scope.adminUserActivityCollection,
                $scope.waitingAdminSearch = !1
            }, function(err) {
                console.log(" ERROR While getting generateAdminUserDailyReport -- single user  ", err),
                $scope.waitingAdminSearch = !1
            })
        }
    }

    /*

    var myScope = angular.element($0).scope();
    var getUserFunc = myScope.getUsers;
    var myQ = angular.element($0).injector().get('$q');
    var myFac = angular.element($0).injector().get('SkillStatisticsModelFactory');

    
    //gets list of all users 
    myScope.getUserList = function() {
        var queryCriteria = myScope.getQueryCriteria();
        console.log('query criteria: ', queryCriteria)
        myQ.all([myFac.getUsers(queryCriteria)]).then(function(response) {
            console.log('**** response *****    ',response);
            console.log(response[0].data);
            myScope.gridOptions.data = response[0].data
        }, function(err) {
            myScope.hasData = !1,
            console.log(" ERROR While query: ", err)
        })
    }

    //send progress reports to n users 
    myScope.sendToSelected = function() {
        myScope.disableSendAll = !0;
        myScope.showWait();
        var queryCriteria = myScope.getSelectedUsersReportQueryCriteria();
        return;
        console.log('query criteria for send to x users: ',queryCriteria);
        myQ.all([myFac.sendProgressReportToUsers(queryCriteria)]).then(function(response) {
            //$mdDialog.show($mdDialog.alert().parent(angular.element(document.querySelector("#userReportContainer"))).clickOutsideToClose(!0).title("Send progress report").textContent(response[0].data).ariaLabel("").ok("Close")),
            myScope.disableSendAll = !1,
            myScope.hideWait()
        }, function(err) {
            myScope.hasData = !1,
            console.log(" ERROR While query: ", err)
        })
    }

    */
    

/**
 * HTTP Post Request to send progress reports to all Afficient Academy usernames in an array of Strings
 * 
 * @param  params:
 * {
 *      createdBy: String           A name corresponding to the creator of the send progress report request
 *      createdDate: Date           Usually today's date, obtained with new Date()
 *      users: Array[String]        Array of objects corresponding to AA usernames, i.e. ["John.Doe","Jane.Doe"]
 * }
 * {createdBy: "joey", createdDate: Wed Jul 11 2018 00:00:00 GMT-0700 (Pacific Daylight Time), users: Array(2)}}
 * @return None
 */
$.ajax({
      url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/sendProgressReportToUsers",
      type:"POST",
      data:JSON.stringify(params),
      contentType:"application/json; charset=utf-8",
      dataType:"json",
      success: function(response){
        console.log(response);
        console.log('successfully sent progress reports to ' + params.users)
      }
    })

/**
 * HTTP Post Request to get all Afficient Academy users
 * 
 * @param  params:
 * {
 *      namePrefix: String           leave as ""
 *      operator: String             a valid admin username
 *      reportDate: Date             Usually today's date, obtained with new Date()
 *      userRole: String             Choose one of "all", "admin", "student", "super-student", "trial". Default to "all"
 *      userHasEmail: int            leave as 1
 * }
 *
 * @return Array of objects:
 * {
 *      $$hashKey: String        Unknown
 *      email: String            user's email
 *      firstName: String        user's firstname
 *      isReportSent: boolean    Report has been sent or not
 *      lastName: String         user's last name
 *      role: String             "admin", "student", "super-student", or "trial"
 *      userName: String         user's Afficient Academy username
 * }
 */
$.ajax({
      url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/getUsers",
      type:"POST",
      data:JSON.stringify(params),
      contentType:"application/json; charset=utf-8",
      dataType:"json",
      success: function(response){
        console.log(response);
      }
    })