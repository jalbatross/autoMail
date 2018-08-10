$(function() {

  // App configuration
  var authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?';
  var redirectUri = 'https://joeyalbano.com/autoMail';
  var appId = '71699bd0-1be1-4919-85e0-cdb4d41b7310';
  var scopes = 'openid profile User.Read Mail.Read Mail.Send Mail.ReadWrite Mail.Read.Shared';

  var reportsSentThisWeek = new Set();
  var reportsSentArr = [];
  var finishedLast = false;

  const NUM_PROGRESS_REPORTS = 500;
  const PROGRESS_REPORT_EMAIL = 'progress.report@afficienta.com';
  
  // Check for browser support for sessionStorage
  if (typeof(Storage) === 'undefined') {
    render('#unsupportedbrowser');
    return;
  }

  // Check for browser support for crypto.getRandomValues
  var cryptObj = window.crypto || window.msCrypto; // For IE11
  if (cryptObj === undefined || cryptObj.getRandomValues === 'undefined') {
    render('#unsupportedbrowser');
    return;
  }

  render(window.location.hash);

  $(window).on('hashchange', function() {
    render(window.location.hash);
  });

  function render(hash) {

    var action = hash.split('=')[0];

    // Hide everything
    $('.main-container .page').hide();

    var isAuthenticated = (sessionStorage.accessToken != null && sessionStorage.accessToken.length > 0);
    renderNav(isAuthenticated);
    renderTokens();

    var pagemap = {

      // Welcome page
      '': function() {
        renderWelcome(isAuthenticated);
      },

      // Receive access token
      '#access_token': function() {
      handleTokenResponse(hash);             
      },
      // Signout
      '#signout': function () {
        clearUserState();

        // Redirect to home page
        window.location.hash = '#';
      },

      // Error display
      '#error': function () {
        var errorresponse = parseHashParams(hash);
        if (errorresponse.error === 'login_required' ||
          errorresponse.error === 'interaction_required') {
          // For these errors redirect the browser to the login
          // page.
          window.location = buildAuthUrl();
          } else {
            renderError(errorresponse.error, errorresponse.error_description);
        }
      },

      // Display inbox
      '#inbox': function () {
        if (isAuthenticated) {
          renderInbox();  
        } else {
        // Redirect to home page
          window.location.hash = '#';
        }
      },
      // Shown if browser doesn't support session storage
      '#unsupportedbrowser': function () {
        $('#unsupported').show();
      }
    }

    if (pagemap[action]){
      pagemap[action]();
    } else {
      // Redirect to home page
      window.location.hash = '#';
    }
  }

  $('#send-progress-reports-button').click(sendProgressReports);
  $('#clear-sent-users-button').click(clearSentUsers);

  function setActiveNav(navId) {
    $('#navbar').find('li').removeClass('active');
    $(navId).addClass('active');
  }
  function renderNav(isAuthed) {
    if (isAuthed) {
      $('.authed-nav').show();
      } else {
      $('.authed-nav').hide();
    }
  }

  function renderTokens() {
    if (sessionStorage.accessToken) {
      // For demo purposes display the token and expiration
      var expireDate = new Date(parseInt(sessionStorage.tokenExpires));
      $('#token', window.parent.document).text(sessionStorage.accessToken);
      $('#expires-display', window.parent.document).text(expireDate.toLocaleDateString() + ' ' + expireDate.toLocaleTimeString());
      if (sessionStorage.idToken) {
        $('#id-token', window.parent.document).text(sessionStorage.idToken);
      }
      $('#token-display', window.parent.document).show();
      } else {
        $('#token-display', window.parent.document).hide();
      }
  }

  function renderError(error, description) {
    $('#error-name', window.parent.document).text('An error occurred: ' + decodePlusEscaped(error));
    $('#error-desc', window.parent.document).text(decodePlusEscaped(description));
    $('#error-display', window.parent.document).show();
  }

  /**
   * Updates the internal Set with names of progress reports sent
   * by looking at the last NUM_PROGRESS_REPORTS emails of
   * the progress report user's e-mail.
   *
   * Joey Albano Aug 9 2018
   * 
   * @return
   */
  function getSentProgressReports(callback) {
    getAccessToken(function(accessToken) {
    if (accessToken) {
      // Create a Graph client
      var client = MicrosoftGraph.Client.init({
        authProvider: (done) => {
          // Just return the token
          done(null, accessToken);
        }
      });

      // Check the last NUM_PROGRESS_REPORTS e-mails
      client
        .api('/users/' + PROGRESS_REPORT_EMAIL + '/messages')
        .top(NUM_PROGRESS_REPORTS)
        .select('subject,from,receivedDateTime')
        .orderby('receivedDateTime DESC')
        .get((err, res) => {
          if (err) {
            callback(null, err);
          } else {
            console.log(res);
            var thisMonday = new Date();
            var day = thisMonday.getDay();
            var diff = thisMonday.getDate() - day  + (day === 0 ? -6: 1);
            thisMonday.setDate(diff);

            var emailDate = new Date();
            var lastIndex = 0;

            var studentName = "";
            var emailSubject = "";
            const numCharactersToSkip = "Student Progress Report for ".length;
            //E-mail title is: "Student Progress Report for First.Last 01-01-01"

            //Filter out progress reports to be only from this Monday or later
            for (let i = 0; i < res.value.length; i++) {
              emailDate = Date.parse(res.value[i].receivedDateTime);

              if (emailDate < thisMonday) {
                lastIndex = i;
                break;
              }

              //Remove "Student Progress Report for " from the subject title
              //emailSubject is now: " First.Last 01-01-01"
              emailSubject = res.value[i].subject.substring(numCharactersToSkip);

              //Find the name in subject
              studentName = emailSubject.substring(0, emailSubject.lastIndexOf(' '));
              reportsSentThisWeek.add(studentName);
              reportsSentArr.push(studentName);
            }

            //Apply style changes to user list if e-mails took longer to get
            if (finishedLast === true) {
              var query =  "";

              for (let name of reportsSentArr) {
                query = "#" + name.replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1");
                $(query).addClass('list-group-item list-group-item-success');
              }

              $('#num-need-reports').text($('#user-list').children().find(".user-login").length - reportsSentArr.length);

              reportsSentArr = [];
            } 
            else {
              $('#num-progress-reports-sent').text(reportsSentArr.length);
              finishedLast = true; //Otherwise, we finished first
            }

            //Send back the messages
            
            callback(res.value.slice(0,lastIndex));
          }
        });
    } 
    else {
      var error = {
        responseText: 'Could not retrieve access token'
      };
      callback(null, error);
    }
  });
}

  function renderWelcome(isAuthed) {
    if (isAuthed) {
      finishedLast = false;

      $('#sent-reports-status').removeClass().addClass('fa fa-circle-o-notch fa-spin').css('color','black');
      $('#user-list-status').removeClass().addClass('fa fa-circle-o-notch fa-spin').css('color','black');

      $('#username').text(sessionStorage.userDisplayName);
      $('#userEmail').text(sessionStorage.userSigninName);
      $('#userEmail').css('color', 'white');
      $('#logged-in-welcome').show();

      getSentProgressReports(function(messages, error) {
        if (error) {
          $('#sent-reports-status').removeClass();
          $('#sent-reports-status').addClass('fa fa-times');
          $('#sent-reports-status').css('color', 'red');
        }
        else {
          $('#sent-reports-status').removeClass();
          $('#sent-reports-status').addClass('fa fa-check');
          $('#sent-reports-status').css('color', 'green');
        }
      });
      renderProgressUserList();
      setActiveNav('#home-nav');

    } else {
      $('#connect-button').attr('href', buildAuthUrl());
      $('#signin-prompt').show();
    }
  }

  function renderInbox() {
    setActiveNav('#inbox-nav');
    $('#inbox-status').text('Loading...');
    $('#message-list').empty();
    $('#inbox').show();

    getUserInboxMessages(function(messages, error) {
      if (error) {
        renderError('getUserInboxMessages failed', error);
      } else {
        $('#inbox-status').text('Here are the last 400 sent from the progress report e-mail.');
        var templateSource = $('#msg-list-template').html();
        var template = Handlebars.compile(templateSource);

        var msgList = template({messages: messages});
        $('#message-list').append(msgList);
      }
    });
  }

  function renderProgressUserList() {
    $('#user-list').empty();
    getProgressReportUsers(function(users,error) {
      if (error) {
          $('#user-list-status').removeClass().addClass('fa fa-times');
          $('#user-list-status').css('color', 'red');
        renderError('Failed to get progress report user list: ', error);
      }
      else {
        $('#user-list-status').removeClass().addClass('fa fa-check');
        $('#user-list-status').css('color', 'green');

        var templateSource = $('#user-list-template').html();
        var template = Handlebars.compile(templateSource);

        var userList = template({user: users});
        $('#user-list').append(userList);

        //Apply check if finished last
        if (finishedLast === true){
          var query = "";
          for (let name of reportsSentArr) {
            query = "#" + name.replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1");
            $(query).addClass('list-group-item list-group-item-success');
          }

          $('#num-need-reports').text($('#user-list').children().find(".user-login").length - reportsSentArr.length);
          reportsSentArr = [];
        }
        else {
          finishedLast = true;
        }

        //Attach listener to remove users from list
        $(document).on('click','.closeDiv',function() {
          $(this).parent().remove();
        });
      }

    })
  }


  function renderSender() {
    setActiveNav('#sender-nav');
    $('#sender').show();
  }

  // OAUTH FUNCTIONS =============================
  function buildAuthUrl() { 
    // Generate random values for state and nonce
    sessionStorage.authState = guid();
    sessionStorage.authNonce = guid();

    var authParams = {
      response_type: 'id_token token',
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: sessionStorage.authState,
      nonce: sessionStorage.authNonce,
      response_mode: 'fragment'
    };
    return authEndpoint + $.param(authParams);
  }

  function handleTokenResponse(hash) {
    // If this was a silent request remove the iframe
    $('#auth-iframe').remove();

    // clear tokens
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('idToken');

    var tokenresponse = parseHashParams(hash);

    // Check that state is what we sent in sign in request
    if (tokenresponse.state != sessionStorage.authState) {
      sessionStorage.removeItem('authState');
      sessionStorage.removeItem('authNonce');
      // Report error
      window.location.hash = '#error=Invalid+state&error_description=The+state+in+the+authorization+response+did+not+match+the+expected+value.+Please+try+signing+in+again.';
      return;
    }

    sessionStorage.authState = '';
    sessionStorage.accessToken = tokenresponse.access_token;

    // Get the number of seconds the token is valid for,
    // Subract 5 minutes (300 sec) to account for differences in clock settings
    // Convert to milliseconds
    var expiresin = (parseInt(tokenresponse.expires_in) - 300) * 1000;
    var now = new Date();
    var expireDate = new Date(now.getTime() + expiresin);
    sessionStorage.tokenExpires = expireDate.getTime();

    sessionStorage.idToken = tokenresponse.id_token;

    // Redirect to home page
    validateIdToken(function(isValid) {
      if (isValid) {
        // Re-render token to handle refresh
        renderTokens();

        // Redirect to home page
        window.location.hash = '#';
      } else {
        clearUserState();
        // Report error
        window.location.hash = '#error=Invalid+ID+token&error_description=ID+token+failed+validation,+please+try+signing+in+again.';
      }
    });
  }

  function validateIdToken(callback) {
    //TODO: validate ID token before using it
 

    if (null == sessionStorage.idToken || sessionStorage.idToken.length <= 0) {
      callback(false);
    }

    // JWT is in three parts seperated by '.'
    var tokenParts = sessionStorage.idToken.split('.');
    if (tokenParts.length != 3){
      callback(false);
    }

    // Parse the token parts
    var header = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(tokenParts[0]));
    var payload = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(tokenParts[1]));

    // Check the nonce
    if (payload.nonce != sessionStorage.authNonce) {
      sessionStorage.authNonce = '';
      callback(false);
    }

    sessionStorage.authNonce = '';

    // Check the audience
    if (payload.aud != appId) {
      callback(false);
    }

    //Check domain from the payload
    var userEmail = payload.preferred_username;
    var userDomain = userEmail.substring(userEmail.lastIndexOf("@") + 1);
    if (userDomain !== "afficienta.com") {
      callback(false);
    }

    // Check the issuer
    // Should be https://login.microsoftonline.com/{tenantid}/v2.0
    if (payload.iss !== 'https://login.microsoftonline.com/' + payload.tid + '/v2.0') {
      callback(false);
    }

    // Check the valid dates
    var now = new Date();
    // To allow for slight inconsistencies in system clocks, adjust by 5 minutes
    var notBefore = new Date((payload.nbf - 300) * 1000);
    var expires = new Date((payload.exp + 300) * 1000);
    if (now < notBefore || now > expires) {
      callback(false);
    }



    // Now that we've passed our checks, save the bits of data
    // we need from the token.
    sessionStorage.userDisplayName = payload.name;
    sessionStorage.userSigninName = payload.preferred_username;

    // Per the docs at:
    // https://azure.microsoft.com/en-us/documentation/articles/active-directory-v2-protocols-implicit/#send-the-sign-in-request
    // Check if this is a consumer account so we can set domain_hint properly
    sessionStorage.userDomainType = 
      payload.tid === '9188040d-6c67-4c5b-b112-36a304b66dad' ? 'consumers' : 'organizations';

    callback(true);
  }

  function makeSilentTokenRequest(callback) {
    // Build up a hidden iframe
    var iframe = $('<iframe/>');
    iframe.attr('id', 'auth-iframe');
    iframe.attr('name', 'auth-iframe');
    iframe.appendTo('body');
    iframe.hide();

    iframe.load(function() {
      callback(sessionStorage.accessToken);
    });

    iframe.attr('src', buildAuthUrl() + '&prompt=none&domain_hint=' + 
      sessionStorage.userDomainType + '&login_hint=' + 
      sessionStorage.userSigninName);
  }

  // Helper method to validate token and refresh
  // if needed
  function getAccessToken(callback) {
    var now = new Date().getTime();
    var isExpired = now > parseInt(sessionStorage.tokenExpires);
    // Do we have a token already?
    if (sessionStorage.accessToken && !isExpired) {
      // Just return what we have
      if (callback) {
        callback(sessionStorage.accessToken);
      }
    }  else {
      // Attempt to do a hidden iframe request
      makeSilentTokenRequest(callback);
    }
  }
  
  // OUTLOOK API FUNCTIONS =======================

function getUserInboxMessages(callback) {
  getAccessToken(function(accessToken) {
    if (accessToken) {
      // Create a Graph client
      var client = MicrosoftGraph.Client.init({
        authProvider: (done) => {
          // Just return the token
          done(null, accessToken);
        }
      });

      // Check the 500 newest messages
      client
        .api('/users/progress.report@afficienta.com/messages')
        .top(500)
        .select('subject,from,receivedDateTime,bodyPreview')
        .orderby('receivedDateTime DESC')
        .get((err, res) => {
          if (err) {
            callback(null, err);
          } else {
            console.log(res);
            var thisMonday = new Date();
            var day = thisMonday.getDay();
            var diff = thisMonday.getDate() - day  + (day === 0 ? -6: 1);
            thisMonday.setDate(diff);

            var emailDate = new Date();
            var lastIndex = 0;

            var studentName = "";
            var emailSubject = "";
            const numCharactersToSkip = "Student Progress Report for ".length;

            //Filter emails from the past week
            for (let i = 0; i < res.value.length; i++) {
              emailDate = Date.parse(res.value[i].receivedDateTime);

              if (emailDate < thisMonday) {
                lastIndex = i;
                break;
              }

              //Remove "Student Progress Report for " from the subject title
              emailSubject = res.value[i].subject.substring(numCharactersToSkip);

              //Find the name in subject
              studentName = emailSubject.substring(0, emailSubject.lastIndexOf(' '));
              reportsSentThisWeek.add(studentName);
              var query = "#" + studentName.replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1");
              $(query).addClass('list-group-item list-group-item-success');
            }

            callback(res.value.slice(0,lastIndex));
          }
        });
    } else {
      var error = {
        responseText: 'Could not retrieve access token'
      };
      callback(null, error);
    }
  });
}

//Sends generic email to self
function sendGenericEmail() {
  getAccessToken(function(accessToken) {
    if (accessToken) {
      var client = MicrosoftGraph.Client.init({
        authProvider:(done)=> {
          done(null,accessToken);
        }
      });

      let userEmail = "";
      //Get user e-mail
      client
      .api('/me')
      .select('mail')
      .get((err, res) => {
        if (err) {
          console.log(err);
        }

        //No error getting user e-mail
        else {
          userEmail = res.mail;

          const mail = {
            subject: "test e-mail",
            toRecipients: [
            {
              emailAddress: {
                address: userEmail
              }
            }/*,
            
            {
              emailAddress: {
                address: "???@gmail.com"
              }
            }*/],
            body: {
              content: "test",
              contentType: "html"
            },
            attachments: [
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": "test.pdf",
                "contentBytes": 'JVBERi0xLjUKJb\/3ov4KMiAwIG9iago8PCAvTGluZWFyaXplZCAxIC9MIDE1NzgzIC9IIFsgNjg3IDEyNiBdIC9PIDYgL0UgMTU1MDggL04gMSAvVCAxNTUwNyA+PgplbmRvYmoKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKMyAwIG9iago8PCAvVHlwZSAvWFJlZiAvTGVuZ3RoIDUwIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlIC9EZWNvZGVQYXJtcyA8PCAvQ29sdW1ucyA0IC9QcmVkaWN0b3IgMTIgPj4gL1cgWyAxIDIgMSBdIC9JbmRleCBbIDIgMTUgXSAvSW5mbyAxMSAwIFIgL1Jvb3QgNCAwIFIgL1NpemUgMTcgL1ByZXYgMTU1MDggICAgICAgICAgICAgICAgIC9JRCBbPDIxYTZlMTdlZDNhOTExZDY0MmQ5NGE0ZjU5NmQ1OTBkPjwyMWE2ZTE3ZWQzYTkxMWQ2NDJkOTRhNGY1OTZkNTkwZD5dID4+CnN0cmVhbQp4nGNiZOBnYGJgOAkkmJaCWEZAgrEOxDoPEjMEEiZXQGLBDEyMx7aBJBgYsREAE\/YGMAplbmRzdHJlYW0KZW5kb2JqCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCjQgMCBvYmoKPDwgL1BhZ2VzIDEyIDAgUiAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKNSAwIG9iago8PCAvRmlsdGVyIC9GbGF0ZURlY29kZSAvUyAzNiAvTGVuZ3RoIDQ5ID4+CnN0cmVhbQp4nGNgYGBlYGBazwAElukMcABlMwMxC0IUpBaMGRjOM\/AxMLDpHHRoYT3CAACFGQVlCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iago8PCAvQ29udGVudHMgNyAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDEyIDAgUiAvUmVzb3VyY2VzIDw8IC9FeHRHU3RhdGUgPDwgL0cwIDEzIDAgUiA+PiAvRm9udCA8PCAvRjAgMTQgMCBSID4+IC9Qcm9jU2V0cyBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXSA+PiAvVHlwZSAvUGFnZSA+PgplbmRvYmoKNyAwIG9iago8PCAvRmlsdGVyIC9GbGF0ZURlY29kZSAvTGVuZ3RoIDIzNCA+PgpzdHJlYW0KeJylkdFqQjEMhu\/7FLkeWJO0aVqQXQjO60lhD7BNQXAwfX9Y2uo53gjCTuA0\/F\/yN20J0GJB9tPC8Hlyv64pibgL52\/38QI\/pnqVXntbrZSgxW4LIzkf3HKLcLh0h0wJCCU1i\/1TyrvF\/e7kWf4\/gNy2K6lLJeE8ALbmkVjzurrlGwJFn6TYl6HuHc03hFBPzmwWRJZ+wQox6CvUo8u+CCemNtkAMV8BiVVrnoCkDtQHzsRzgwyn6FGpqOgEMDwAYYDiVSVh5AnwsCL0kiNrDDMpnWzqc2clUZ\/tuu8OfJ3GHNpz\/QFrfXT\/ZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8IC9GaWx0ZXIgL0ZsYXRlRGVjb2RlIC9MZW5ndGgxIDMwNTY0IC9MZW5ndGggMTMxODAgPj4Kc3RyZWFtCnic7X0JXJVF9\/+ZeeYubHJBdhAeuHBVQEBwz+Si4BLhiiaGyQWucJVN7kW0TPFNU8mlTUsrt6xMMy+4hLZoe1pm9WabplZW9vaa1lv2Gsj9n5nnuWz2Vr\/l\/\/n8P\/+PXL\/POTNzZubMOWfOzIOCQADAC+pAgpSicktVyd6cNQCBnwB0X1001yGvq\/pgLsCQEABtysyqkvLank\/\/AtC7FEDjLCmbP7NBOrgPIPefALqZpVZL8dHBl+\/FEV9ADCjFCv9yvx3I\/4yILS13zDu61W4GIIMAAjaXVRZZIHbE7QDm0VjeVm6ZV+XxrvcD2I7zgVxhKbe+TEqGAuTnAoT7VFVbq77fNedLgGRs97wKXHf6\/j\/vuPvc+hm+Q3\/Rh+uBf239qmc8p\/tubHzrt91XSwxD9Ddj0QPliRDAp25Y61gYYYDfdremGYao9W1fml68RtMLH+lQBBqgYIBkGA7AvHFeCahW7UIHt8FJP4bbmB0CEWN0PaBWMwWmkmUwje6ABRxSDzCzZ6AaZXdgOQPpQd4X5ScjziCGIqYgwtS6HIQFMYmXUfYA74tjVPFxBLXDNH0UVGqmuK7ifOs0b8JMxEbkt7KvYLt2MJRjeRv2O8QABnIZ7LNOuwMexvpHsb0I6zYinYrlLcjnY78UlffQrYJQThFarO+N49yjrren9DIMYHbXF7iWPBzzJsTdOMd4pCMR2SjTHelwxDLyJiwnb7q2YjtSuAvnX8brEZkqHY3jLMX2dOwXi+W7kA9DPbRIfRHRiF70GRhMA+AFpMm4\/luUdSPehFK+5rY1of6qTtdC0TG7I3DOFxFGOtj1NVKPDrp1xV1dMEZKgzqksxHhiAn0GJSzm4GgvdZrvgaJAyOT2+k04kZWDGOxTFDPSZq9sIGXETkCdtdV9ihsln6GQdh2u3YdrqMY7d0XcRmS6T+hjzYOFmF8ZeL4ixEbcczzIh6KIRfnT0Kaxr4WMXQ3YiXOddFtJ24bLC9Gv07EuVr4jsH+kxCj0C91iDKuD86fzG3O\/U6mtA5G2XMok8+B9cECuHYek7wP749jxalxuLWdwlaUWYV2PYuUIQK5Dm6IOFOBbW\/gOKEILaIHIgnxNWIrYjZiCOI5RC+cG3BeScQrxgyPTREfGBuaN9GGqJuIWWUNG4U\/lT2zRR2LzxOtfQZmq4jmY\/L9wmMWdWlwj833FI8ZNxXxPZvHPfmRr5PHVBvFvce+h1FcB7EHMbbclO871Jnvh3V0MixHugHj+C4es1w\/N+V24bEmbIJ7QqVDO6w1RewRpBKAUY31u9zUbYs2WgrbcMwCbSHmlM0wmjlgtHQfFLJLkCn1hiRNCtbhelDWSb+HifrDkIa+HIfl9V3owxy6E2SW5jCucyfa8wQ8hjadw07QGHaCaDQ7Xd9pgBzR7KQLBX8N7QpyWGnjlKNj23+1\/r8D+pFmJ+bMna5\/aE64XLie+\/me0H1PUhCym2J9I6IOEa9PIA\/rZ5Mm3WQwaPFsQ1QyMwzRmGEgO4z+CcQ8j3sB6ydrvoBD0ipYwU64PiV1UEdPwN26QLDQdZjTcC76EdzFwcdHWtUhjjrFXNdYclN3vHalPOerMRWFVIv7710V51RcRvyCcfQ4UeYYyPOzOB8wRyPuVuLV9VtbfB6BJ5De447PLnE6u0t8eneNy65UnC2Y3937FPVY4V4\/z488x\/EcyfMczzNu+a60Q\/96ugPjmOfhYzBN3dcxKm5CHb9U9z7mYfT3LS6XdqTrKe1e13bJ37Vdm4r8JwiN6ylc97y2M3Wqq1U9T3u7z1KlHrzc56gmDcrVfLZN5Juf4EFxjk4R+nlod8MiTTP6HXOg0HezugfRnqj3bFaANt8AK3EdodIy3I9Yj8jnNhG+AAjh5wI\/E6W1aGd+Fq2Cu6STeF\/gfdPAT5wX6XAL6n5E1OGZyimv09wCW7XfQyqbjLn2MBRzX\/F1cH247\/U14KMPxDxxAvqyp1EmEDxRbrOwgRmeEnHB+87GexHaQlcEOozZsSjDx9si+pjBX7XHNmEL0R\/vIjy+uC1wTG0gTBT3ie9hk2Yy3IJ7aIuuDrZoJ+OeC4TtOMYT2G8y1wX7hYnzei3civtrOeam5ZhzQMT\/NFeztBPXMw\/zOkKqQxvthBBNHdpwtlh7JlNy7DK+f6QdYOIxol2LeZjfJ9ZCPUuALO1sWIV1qzSYJ3Hee7BuCe7fFNy7K7B\/lJq3AedegfW8bzq\/y\/A7At8vOjN019aJewAIHfg9BeeXvoMt0k2wHOM4Q78W7bAU+uB5QTD2IhF9FYjyQhUrFYg6g0JJtGSAO0V9GnxAd0heGLf8DD3AFoONTYFUqS+EMj\/ow97HvXoFHpF8YQY7Co+wJljJy6w79JKcuP69eLfk9cdhPK+nH2D5YZjGhmL\/5VDBZoBdasDY+xA82Uz0NfbTrMY4icX+P+G4KshXME2agnvrbuSvuJ7hcmKOva5bONho6CP6dYDQ1Y0uOtNstNtN6FPUl\/Od9EVd2\/R06\/g7+ol18nGxH5dhjwC+M7hOIeIU2jqBroKdiM30Mxgh5cB8sh0TzKMwknyNeFTFLhgtaANiAp7x\/ckCRBLrD88hFiOfiPQlxG6ljHe3\/nASsRTHfhnpHv5ewEGHwwBOsW4j4mHE2+62juBz\/V59R2jCoXN5H9RxkJ9dVzm6yqOdB+B8A9iNaE8ExuK9HNpFME03F\/3XE+sjccwuZZwnle2DWX+mz5+BHIcUYUMF5o5rdPsDadBfwKkOVOZUPRv+R\/r9d4D+XYSYLuz7AwSqMdSNfAQxSKcgnSLVwDwOLPfBcp7bngTffgW2wwOivs1\/Sj3GCr5Swo1d67uWu\/r1z8p0DzzREe44aIuH+2EJB0tHeUTXsv4ILOHQvo5tr19bZk\/9CaZBvLRB6AQixrqUtePwzETQWNQ1TPRZydFWPo57GcFlRX8fWMUh9i6C7gUbR1t7f8zfiA52HcDtinOKdrd\/3H7p6h\/Uz8zeRUzDs+JdSEE6CWmGm7bFt5ovOsX8BCXe28o8l3zdRaZ9T7TvjeP8rPn9Mf9\/Au6do4g3EW\/8356LZxmeIww8T5zCe0g63iNP4P3kVrgL4CrmkpZkxJOYh3KRfox1eHq39kb4IO+HdSVIHwNo\/gX5aqw\/ocBFWThsVu+VoVi3X+2rV8ebpPRvfgvgN4yo33Yr\/Zt3IGYh\/yPiTuQ\/R\/oy0odR\/h\/YbwnSV5T2qzOwPBfxApa\/x3IZYiry9yINRJqI6I7wx\/7rOPh95Jr30P91+vvvH3+V4p2lCPWM4t\/zQrqg6zvEX6Zuf\/4J7fqu4fb\/n9EO3zPoQhU74DvTl3jvc3Z89\/mjdxw3RX+2dgSb7LqKd0pvfo\/md1l+fxb3R5WK9zdxj8V5AQLclN+d+f2V3535\/RXpFqTLtRqhz2T+ns\/1AnGkCESIDQEeE7GEnOdUYB4D+Pdg+bdBYRAsJIvIGnI\/2UKc5BRx0Tz6Jj1CP5eIJEkeklFaKNVLK6Ut0rvMm41j+WwGe4A9xB5jj7M97Hn2KftOc0DzquYfmp+13tpwbZR2iHaidra2XDtHu1B7t\/Zh7Tbt09rd2ne0J7RXIpdGXpF95UA5Uo6RTXKSnCKnyUPkofIwOVOulBfJ2+Sn5GeiNdHdo4OiY6JN0UnRudG3Ra+N3h5DY7QxvjH+MYExYTFRMb1jEmJGx1hirEZqNBij4yCOxnnHGeIC4kLiIuJi4xLj+sUNjSuLq4tbErc8bmXcA3Fb4p6Ja4w7GPdC3Gtxb8cdj\/s07hvTUJPZNNxUYCoyzTTNPq85H3J+yCV6qW8zbZabBzQPbR7WnNGc2TyuOa\/5zuZ7mtc2u1oKr6Zf\/am1xdXicvHvUMNmYbnNZDc5Rn5Dy72BlvtEgjbLLUHLrZYeZ4R1YxPYbexeto5tYFvZs6yJfcLOa5ya5zXvaS6plovWmrUFv2u5S5F1kZtlb7m7HCzLaLl4tFyqPFi13Cy03ONouR2dLDcp+tboe9ss54eWC42JVC1XEFMsLCf\/B8uNb7PcvXGb43a0We4oWu4TtNyQNstZTbPOE2E5cok1E7RcfPMgtJy5eUTzyOYpzbc31zevbm5pue3qMLRcHbec6ysMzLWuAHqUviglu07Rd3BH+GJE3k9qyWxS3bIZyzYes60JrfGtvVt7IbsAboe5UAalcDMMa\/m85VTLey1vt5xt+aDlOJdsWd\/ycMszLVvw80DLopYlLX9rsbWkAXw1HeDLU8p39c8uRaz94tazS85e+WL72VosPYfAvHq2\/uydX9ScmXVm\/tmDXyWeXX1m+5l1p9ed3nr6HoDTT\/K+Z4JPzzmNmfl0ymnz6bTTsadGnso6NfTU4FMDTqWdSjnV+1TMqfBTAafIyR9Ofn\/y\/MmvT37Je5184+Shky+dxFlOvn7yiZO7T2adHH4y42TsyZiT0Scjww6H\/Rb2heElvOm9pHtS95juUd0jug269bqHdUd0u3RbdJvw\/PpOO0yDb6dSEd+7ZEDnv6eg3yjoVL4kBbnLUjH8wZc0FjPN77esRmzEG9FYNpEVIC3s2MpuQ8xU8J++2HgONlEtjf0jPbr0NLFebXzsH0p6\/seWmzsVJXgclsBS6TZYB9\/A3bAa7oHH4GnYhleEejTrXfAAXIIfYRU8BMvhFTgFF2Ej7IB\/wU\/wM2yFZ+AteAN2QSEUwb1QDEfBCm\/CEXgX3oZ34Bh8CzPhfTgO78GzUAI\/wH3wIXwAf8dY\/Q6+hxUwC2wwG8oxeitgM1TCHKiCarBDDTgwpmvhPMzD6J4Pd8CdGOfPwRZYBAuhDhbDP+CfcICsIw8RSiTCiAaaoYU8TNaTDeQRuAqtREt0RA8u8ih5jGwkmzAXbSEexJN4EW+ylTwOl+FXso08QZ4kT5Ht5Gmyg+wkz5Bd5FnMWU7SQBrJHvg3nCD15B6yl+wj+8lzpIn4kG7kADlIfImB+BF\/OAtfkO4kgDxPXiCBJIisJC+Sl8ghcpi8TF4hwSQEdoOThJIw8ip5jYSTCNKDRJLXyRtwBX6DL+ErEkVkEk1iyJvkLXKEHCVvk3cwZ75LjCSWxBETOU7eI++TD8jfyYd4Q+hJepHeJB7OwdfkBHwEZ+BT+AxOwmn4GD4nF8kl8iOeVT+Rf5GfyWXyK\/k3uUJ+IwmkmbSQq6SVJOI5BpRQSiXKqIZqqY7qqQf1JH2oF\/WmPrQb9aUG6kf9aXcaQJJoIA0iySSFBtMQGkrDaDiNoD1oJI2iMl1Jo2kM6UtSqZGk0VgaR020J+1Fe9N4mkCX0xUag8aPXpQWS3dJS6Vl0gpplbRGekBaK62XHsOT8wnpaWmntEvaLTVI+6QD0ovSy9Lr0hHpGO7V96UT0qfS59IX0tfSd9IF6aL0I\/2R\/kT\/RX+mv9DL9Ff6b3qF\/kabaYvkKXlJ3ni6EFzUNvYEe5I9xbazp9kOtpM9w3bhqbKbOVkDa8STeS\/bx\/az5\/CcOcAO4jn9AnuRvcQOscPsZfYKe5W9xl5nb7A32VvsCDvK3mbvsGPsXXacvcfeZx+wv7MP2Qn2EfsYT6lP2WfsJDvFPmen2Rl2ln3BvmRfsXPsa\/YN+5adZ9+xf7Dv2T\/ZBfYDu8gusR\/ZT+xf7Gf2C\/mKnGOX2a\/s3+wK+401QwM00nrSD\/bBfngV3472wF54Df4GL8MyzEXjpInSeGmCNFmaIt0iTZUmSbnwC\/mWHmYL4QVYDxdwZz4B95N0WEMyyFxyH54XD5BaaCILyAXyA5vDqtliZpfypGnSrVK+NJ0tYTWsli1lc9ndbD5bxpazFaye3cNWsnnsQbaKrWZr8ES+T5zJj7BH8U6zEW82D7P17E62iW1mW\/CkflzqLw2Q\/iXxd0QtgPsvignFB+2SdrBRYhqtTu\/h6eXt083X4OffPSAwKDgkNCw8okdklBwdY4yNM\/Xs1Ts+IbFPUnJK39S0fv0HDBw0eMgNQ28clm7OGD4iM2vkqNFjbsq+OWfsuPETJk7KnTzllql5027Nn37bjAILFBYVW2eWlNpmzS4rr6ismlNtd9TMrZ03\/\/Y7Fty5cFHd4r\/dtWTp3cuWr6i\/Z+Wq1Wvuve\/+Bx5cu+6hh9dveOTRxzZu2rxl6+Pbnnjyqe1P79gpPbPr2d3OhsY9e\/ftf67pwMHnX3jxpUOHX37l1ddef+PNt44cffudY+8efw\/e\/+DvH5746ONPPv3s5KnPT5+5fne8fne8fne8fne8fne8fne8fne8fne8fnf8a3dHc0aGOX3YjUNvGDJ40MD+\/dJS+6YkJ\/VJTIjv3aunKS7WGBMtR0X2iAgPCw0JDgoM6O7vZ\/Dt5uPt5emh12k1TKIEErOMIwtkp6nAyUzG0aP78LLRghWWDhUFThmrRnaWccoFQkzuLGlGyZldJM2KpLlNkhjkoTC0T6KcZZSdxzKNchOZNmEq8qsyjXmy84LgcwR\/r+B9kI+Oxg5yVkhppuwkBXKWc+Tc0vqsgkwcrsHLc4RxhNWzTyI0eHoh64WcM9hY1UCChxHB0OCsIQ0U9D6olDPMmJnlDDVmcg2cUlyWpdg5fsLUrMzw6Oi8PolOMqLIWOgE43Cnb4IQgRFiGqd2hFMnppFtfDVwj9yQeLh+ZZMBCgsSvIuNxZb8qU7Jksfn8EvAeTOdwbefC2kv4uD+I6Yu69gaLtVnhdhkXqyvXyY7N0+Y2rE1mj\/z8nAM7EvjRhbUj8SpV6IRsyfJOBtdmjfVSZbilDJfCV+Vsj6rMYvXFMySnR7G4cbS+lkF6JqweidMnB\/dGBZmPuA6C2FZcn3uVGO0Mz3cmGfJjGgIgPqJ8\/eEmuXQzi19EhsMfophG7r5qoy3T0fG2tYmOCHOueyJbZYlXCPjGAwIp1wkoyZTjbimQfxhHQT1RYNQDL\/yCPZyFqNHbE6PEQX1hiG8nvd3auLwjlj\/C+b2AuOFf3ausag12jjDL8BZHidtoYbtbt6ZkOCMj+chohuBPkUdh4ly\/z6Jc5uo0VhlkJGg+WA82taSNyQZzR8dzR18T5MZCrHgrJswVSnLUBjeCObkhDwnLeAth90tgZN5S527pa17gREjea946wt06k1tf3wNQd2zSoc4SdAfNFuV9uxJxuwJ06bKWfUFqm2zczuVlPZBbW0q5+w+YqoUTlWOhkuiFYMyv02YF6Z6O1kc\/tGKoC5u0ukxKkUNkUc6DQWjlWeeZ3T0X+zU5LrEewnS3k1V0zkkoXP5hk7lTup510uoMDPR7Nxp9fWendow1JQJx6gEIx5yp0bLI5wwGXdmHP5pch0exJEX7jSjyUZwAYw\/pUotdhIMV\/k8\/OLR2SdxJCa6+vqRRnlkfUG9pclVV2iUDcb6A\/QV+kp9VVaBO3CaXAfvCXeOXJmHtiolQ\/pkGMFXCoaLCBdCgih8JiPGIWYg1iA2IbRCjtdUIhYhDiEuiRazFNx4f5q5Cck9guyZVZYqihalmD9dFPfckqfQnAkKzRyjiA1RxPr2U6qThiu0Z6JC\/eNS6zj19Ek9nBGEV\/f3EBSq8Enoa+BLCETBZikQnAgqadUas+S\/J9aUuumQxACvAxLBa2mU67BEGn38UjM8qYteBH+Ioj\/QC0oLvbCnm1\/qpoyb6JewG3EIIdEv8fMF\/QIW0bO4A3zxmY7YhDiEOI64iNDSs\/g5g5\/T9DRKfQ7JiHTEDMQmxCHERYSOfo5PAz3F95N4cj4dQekpfBroSVzWSXz60s+Q+4x+hqr9vXHg4NQDgklIVpmoOJUJDlcZ\/6DUJvpB45XeUU30qz1yQtTmjBT6ITgRFCf7EAf\/EGTEeEQBogqhRe4j5D6COsS9iM0IJ0KLfT7CPh9hn6OIdxAfQQrCjBiP0NP3GnGaJnq80TQ8KiOIvkvfhGA06jH6lqDv0DcEfZu+LugRpJFIj9I3GiOjIMML2wH7GJAakCZju4a+vCfWP8qV4UcPoXmi8JmMSEeMQ8xArEFo6SEa01gc5Y+DPA9H9YCSjfCdoE\/CVj2YZ0WZTSMwxmT+MA25ETl8bJI3majZtG49FvnDtPp+5PjDtGQlcvxhun0xcvxhKpuLHH+Yimchxx+maTOQ4w\/TuFzk8NFENz4X2zNq4LjZRM7wpbVopVq0Ui1aqRYYreUfuMK4bo80xsejxTaYE3rHR9UdJHUvkLqJpG4rqbOSuoWkbjGpG0rqbiN1CaQugtRFkjozqXueDEJT1BHz3k7FweYQUneU1O0idXZSZyJ1caQultTJZKC5iUY3jkkTJEuQPRl8XyG9cViqL+oYjRaNxrCOxm1\/CJ\/HES5RMqOQHKMIh0ZyGrMnPl0pJw1JrcwYTV\/Fjq+iG16FMwiGDnoVw+hVHORVHMAXn+mIGYjDiIsIF0KL0jGo+Brx9MVnMiIdMQOxCHERoRXqXERQqFRV3C0US1aVHsdL9FX8xOAnmkabexgiDAmG0dKaCOIbScZFuiLpQAjib\/n+fno\/fFvb\/6vPv3\/1AY8MD7qaroEe6Ih7Vbqm8UqPqCbycKPp+aiMQPIQRDKMOjIYTCQO6SCwi3J\/iNBz2g8i6E6kqY0RU7Cbb6MpMeog6cZ77Y+6EnEu6ruIJors+Yjnoz6WmxhpjDqBNTv3R30YsSLqSHKTHmteMDURJAdlIXogYlDUrqNCdDE2bGiMWsjJ\/qg7I0ZFzY4QDVal4TY7lsy+URNN06JG43iZEYVRZjuOuT8qPeK2qKGKVH\/eZ39UCqqQoLDxqGzvCDGpMVIMOHlgEyk1J+rW6abqxukG6FJ1ibpoXZSuhy5cF6D31xv03fTeek+9Xq\/VMz3Vgz6gyXXWnMC\/ARygNXDC\/80AASZ4A+VP\/r1inteInsJN4OwuZdPsScNJtvNwEWQXys7Lk4xNxBMPUI1xOHH6Z0N27nDnoITsJp1ronNgQrZTN\/7WqQ2ErM7DWidd3kTw9GsiLl61NJxfVQ8AIX5LV4Vz2mvpqrw8CAmamx6S7j\/Mb\/DIzN95FKjPhPavkE58D+e67ElTnTt65DlTOePqkZftfIDfZQ\/g+\/OlrMwD+CqNJG\/qAWkY+SlrIq+XhmXm5WU3kSlCDmTyI8phxPwo5PSRIHM5kPWRitwGRS4O+6NcLCco5+EBcUIuzsNDyDHC5RrssVmZDbGxQiZYBruQsQfLHWWOxqFMXJyQCaqDo0LmaFAdl3EOEyIRESgSGSFESBhECJEIEiZEprSLJKsiK9pEVoiZJNIuE6HI+Jx1y\/icRZmEv\/plHZ6QQPbckFeUz98DCoxZVkSB8565pSHOukJZbijKU18QTAWFRaWcWqzOPKM101lkzJQbbsj\/neZ83nyDMbMB8rNypzbkm62ZjTeYb8gyWjLz9owa329gp7lWtM3Vb\/zvDDaeD9aPzzVq4O80D+TNo\/hcA\/lcA\/lco8yjxFwgYnz81AY9DM\/Da6ege6iXJ8ZrQXh03vAgQ9UwEbw3RIcsDD\/I+D\/s88JbuDe+0fkgeFOfjD4ZvAn3FG\/qxl\/21KaQhTdEhx8k29UmA1b7GYdDgqPGXgMhWbZM5Y8dv7DKUcMNrjwT7P\/pC9uy8L0t0+4AyHbGT8p2puM9t0Gnw9oCviTnEHedl1cWXjeVyiSsHMIrJalNkNcN5XUeHqrgtf6vUekIvgvq6PN7iDmSOMCeJzkjs3MppoJc9VZ9EK9L\/Hiw5+EC7SSB2N1jCLVB4YGv1w1HjcqpdnCoVOmFXexuc7R9YR9MVZqDEIoI0zwFocwEIQCubxHnOW21uc7zdk7pP1C4SQXAdthFbLALDsEr5BLw7+wdgL3AbzyZ8CgsgAdhGZ5i07BmBUzEjwbrHyShrr2QDFvwHNsCx1D2FlgIByGIhLi+g0WwVPo79loKPhADGTAeKmEVudlVA\/lwht0FA+FmqIAqUuea6lrtut+1DZ6AA9JbrqvgBWFQhJ9jrh80n7hOQR\/ssRbWwxlyv8c+MOMsdSj5GFTDBmk6I64S12+oQTTUog4McuAYOUwTcHQrfEtCyAJpBI7yuMvpeg2lImA6lMIGOEj6k1E0WpPvynEdgyCcYx6Ouh4aYT9+muBF+Ix4ay65trkuQSgkwhhcz154lxyWWq8ubk3nhkYr9YbB2FIJL8Gb8B4xkpdppcZbk6oxa253fQgB0Bcmo7ZPYc9vyK90IX4WSW+wka7h0A3tch+3NrwOX5AwkkzGkSm0N62kG6Vq0OOMffFTDDa098M4+mmMmv3Umx6XHmc7WbO2R+tZVzf0iAkegcfgZeKDK5WJnfyNfES+oiPoDPoI\/VJ6kD3NPtBZcNW3QTmsgp3wK\/Eng8gEcispJQvIMnIfWU+OkffIeZpBc+lselEqleZIL7Lh+JnE7Owuzd2ae7TnW6e2vtb6fuuvrlTX3TAB42Exar8WNuLKDsBx+BQ\/Z+BLoiFepBt++Hd9J5M78LOQrCJbxfeg9+Is75EvyXd4Av1CmikerFRLw\/l3WfFjpNV4oXyQPkqP4+c9+k96RQqWYqQEqb80VMqTKlGrZdK9+NknfcHC2HHmQjunatZpNmm2a3ZqXuF\/n6b7Gx7p77Q8fjX+6ulWaF3euq61sXWv6wsIRB\/iYYGvUENRewt+ZqG\/12HE7Ya\/E2+0XRiJJ8PIzWiZGWQWmUPmoSWXkA3kCaH7s+QFtNLH5CLq7EMjhM5JtD8dTsfh5zZqpXPw7nU\/3Us\/or9JOslL8pUCpXhplDRdskoOab60TnJK70ifS19Kl6UW\/LiYJ4tiMczEEtgoNoPVsI3sW\/atJl\/ztuZrrae2XHu3tkn7I15ihunG6ybopuvW6PbrPtQX8O+iwj54ruNfdZCz0mIpS9oHq2kaC8U3lncxnmdAsZRDMVLpdrKc3kn20ljNPO0N9AYyFi7hq\/2D9A26iV6mN0g5JJtMgln8J1X5lzaA8Z\/8HspehQvsBVzbuzjyPK03WUgvar2hkYifmyavSyksQXobPpPOEB3bAieZJwkmF+hT0niMghfZMM1UiJYehWelOeRO2EezADyb9SsxjseSHZgXckkq+bfkwlvvWIyigdJXcBfMpp\/ABdzHy+EhUsxKYDWkkQXwLTyJu6K3pkIbrw0kR6iN1dPuZC9Q9jT\/eWYSSyRNACwh06UN2ov0U6iB48wTTkvPoPbH6bNSDrukmUhKcQfcCXfDHNdimK+Zyj4gJSCRKRDHzmJ2WyClsmikizCr5GNO24+7+yDmgQwpB2tCMHJuxriYjBliA34exjzBMIJsuMdvwSz2LuzV5tImKNF0I5h1ANjbrRNhmutJWO8qgQrX\/dAH88Ey1wIccTt8DWtgO1naegdU4Zvjp7i3b9aMpMc1I119aD39lE6i6zr7F60dR0LgH\/h5FkbCMM3zUM8+hkmQ7lrpOoHR3Qsz7HooxPvpOVzlDzjDaOkwpLWOpQ2ukVIVrvcMTHA95YoinlDqKoNx8AI8odOARZegTlD2\/y5Iroq3\/hpodRd88z8HS\/nvQbuB\/36F67iO67iO67iO67iO67iO67iO67iO67iO67iO6\/gDUCL+wkXD\/1W\/DobvpeScVtdE15u7g4adk8BTx84RCNVrNeeo9ALtCx5kPUmCkATD5aFXh441\/Dw05+pQSEfe0IKPvinRftF+cfggwKBFlg63mPk\/spfZYf6zYRtxrmmag+ALPWCJ2SRHkRH6iB6RlFA\/Q6Qv6INNsgfxCIvqYZCJDASmR96Qz6eazse\/PP2CmChdzDNivnmAFK7Ta\/UaPdMzbWhIWAjVenl6e\/p4StrAoICg7kGSNlwKjib+3fARoo+IJkGeftGQkEASEuLxazGZnuYXnRocFBzkHxhAu1FjXHTqgIEDBvTvZ+ppMkZvJFd2TluY57CPvf2+Y0tbG8jg+57om5XzUNnYXa3vaA4G9ri5sPX4a0+1tj5tSd01oG\/Wd09+82t8JP83DdsB2FJcpwdkm+O1mki9fo2O6HQgMb5W0OselansRWmYF\/NQV+rJV4r2nM4NOhYXm3MO0vlS\/QcnTx9q4EtGZQOjBbZLn7d8TZ1Xx2sO7modsuvqTMW27CrO6QMhcIu5v9VvdgDNNmQH3Gq4NYB5eUf6dusGwSHK\/P4mfZgcRvBPWIiPqkBou6nHGuZMv5xzoW1+YXAyHRRzRVI0VnS0H\/JtlqK9788puz\/vh9YjrcvJHS9snH5z3yWtKzQHu\/lb95c\/33r16jMSWbko\/65AH5yKfwf3IGqqg3FmHw2NZBI3iVbDPJqofY\/MCGsi5DmtTGiyRCTk9xGhIm\/V71+vaMktZbh6bvo3hqGGoYqmIvj6c\/vQ7q09WH1ruMZn167f\/sUjL9t1nkWyYRCIkXfaXBwFEYF0sjRdM91jspdVmq2p9LB66Q1gIAba0\/9TzW8Bl8N0ff2HhPaNyPDPCcuImOCfHzoxwuJfHmaJmKedF3iZXg4xQBDx9QkOHh9UEFQVJAVF+N5r2GygBgMLj\/DUobo7zB5kbfcI5hVs9mlyHTZ79Izv5\/QhPmFRWNoTZ+rHqblHpLFfShSJCkozxOrMsfH9onTpunE6SRca2W+gEhMJOVfPoVMSEi7PSeB+uXD1XPoFERhX5wwlfv6DB\/sPVjxE5lSTYK3WGAN+BkhLBb8AXXRQUFrqABLNPRWjlW47mPjDge9aL5KAUydIN9Jy3rNxadHKq5\/RCd6DpqxY8DSZEvz4XhJFJOJNerWebr1ikHcfLCVr7x5R+iSP7XTXeakBLZlCPjXfwWICYoZ43OSRGTslxhqzwGO1x5LYJ7vvTHxF8vEIDgsJTslO\/ChYE04nU2pIJZ4h+fp8j3zPfK9873yfWfpZHrM8Z3nN8p7ls9e0t6dvT1Nsz9jeA2KneeZ5FZuKezmMjti62Ac8H\/W+v9dDiWtTtnk+7f14z2299pheNwX1aHKdNvtHDp6m7xnn7cnCZFMg80rqEcatHhEVmh46LnRG6O7Q46Fa39Co0MrQM6EsKnRNKA19nk7GKAAUMxiImVADeQ+3BDEQSrhXAoL6cWqO7ObXj5Ck\/B5lPWiPiEAdi0jyisL9Ehtq7h7SL7SJ3tqoi41HyeciBr8XT+LDUnkvE3q4IPVwKk1PrUulqQZCSCzIsb4xZ4CkwzgMxNC+bqfOyfn5guFC9VjD9DmKX39OuFCNvk2\/MAddm5AwfU71OcNV\/kQH4x\/0c\/BgkfjMPftEGjUBiSY\/g7+hu0HSxvjI4eDRSxdONH3wERmAxehuxnCIMfp463t7hpNePT08tQksHKIMPcIJ5kC+bZQH4f\/EIT5h8eLFgHOS6dVzpncfKGKmf7+epp5JtH8\/nhTTUoOCgnUmHkOBATxnikTAQ82U3ui74o4F8\/rHPfDG+nEZg+Lvm3Tni9P8nN5224JZQUHJ4UsOPTTF9sadxz8lN0bMrrZm3mgMiUsds3jsqPm9ohJG31ESMjF\/4kBjRI\/unrFpGQvyp2265RkeabGun2i8Zj0EQ90B8ETfGE39PLiVM5CpCyVAvH08iQRBBo8EX09tUITk5WuIgRji4x\/nTVw6fZZHVoGuSlenu1fHQCfrNuucusO693Ra3UE6C0LIgIaZIpnM+fmc4QI\/Ys79PJQ7AFk\/3FF+aWmGI3xbJSTEBfN1mvr7Gfun+Q30Sws0+gVwE1FD2M1DC8sSlyzZs29f94RekVs2GYZZt9KilURX1rpq5dUHchLDlL8HHCmNBeW3zwC0qj9Hx1fpSYapPIVumtPg\/i01t2kOqzzrIKOBEM0PKq+FbtpIldfBa9pEldeDSbdA5T2g3mebynuyV8TMnPeCwm5JKu8NM7vdq\/I+2r3aSyrfDfK7XW778e5FvhPB\/bvCNb4\/qjwFnX+GykuQ7J+q8qyDjAa8\/ceovBblLSqvg0L\/UpXXQ\/fuBpX3gKygWJX3pBbf91XeC\/oG2VTeG9KCNqi8jzTN\/6jKd4OkoGP8t\/owCXXzDmoWvPht5cFegtfy+uBwwetEfU\/B6wU\/UPAeqo8UXvGRwis+UnjFRwrPOsgoPlJ4xUcKr\/hI4RUfKbziI4VXfKTwio8UXvGRwis+UnjFR5z37LBeL7GWUYL37lDfTaz9FsEb+FqCSwTfHXn\/4BrBB3SQD+TjqHxQh\/pQ0XeZ4MPFXMqYPTrIRHXgY4X8WsHHC\/5xwfcRfAPn9R3013eYy7tDvbd7LbkwH6rACjPBAkVIZXgakQulgs+BSqhAOFQpGUZgqRp5\/rRgvU1IyFhThv2TkMsU9Zb\/4UjJbZrJMAlbysTPpCoydqwbg1SZry8Mxk8K9FG5VFGbgT3KkE7EPiWog0P0mojj2RHVMBefxUKHCmyzQnmbJtU4r4xSFnUmRd6GFpKxB+\/PR6yARDELb7GImYrUsSxYo\/QsFyPyFZSi9uViRBu2OIR0qZiLW92hzmAXKywSfR2ivUKMwinXqVLoYFPXUiXG5hoVCa3sYjbewuWLBVX0rxGzyWKGjlrZxPgObK8Q5Voxdqk6u1WVrRRjKXO768vE2A7VIkVYUizTVc6BY1qFVWxIlbGL1JoaYWnuq\/YoqRR+qRYWLRP9uaY8OsrVXu4ZikT\/ueqsNnWlvE2xZrsVZqIkH02pbberTbVupboSm5CvEaV2r9pFxJYJ7X4\/Jtw7x962Ft5WLsZrH6Ma55mtamtR7V8kYlpW495ts2Ixd4moVfrXYotN9SGXKUPfKzFSic8SbJurWlsZoX0vW4SvlOiQhQ2L1PXbhNfKhEyV2GdKNFaInspKOka3rS2yZGyfp3qmXGjDY1Pxm13dyWVtepSLUnv0OrrkG3uX9RWpcxSKEWqEpYs7xaYV5mC927I14l9hulc4U8S2LGJgnrCtXcSdQ3ijpM3rXHdlv\/O9lNi2m+xqlLXnI6W1XHjEAreL\/orWfNwi0doeacrsxcJaVWKXzG9bhXtu3r9WtFuEJarVOfgeUqzoEP3dGrtHrxIxVC5yqFu3pGvy6pBOXuP5rkTEP\/fuEJiizufOtTxXDsKnDL1wJO6DarEflH3Uu8NYORjX7aVnRZxXq\/u+XIw+u83H\/92cr\/ilRM2EVjW\/tecpZdTJeB7IMF70l8Ek5svB5zice6aIXLfFeGzahbVL1dGSYCzK5eLpMRIxAlfE+XFYy\/uPxOfNoj4Laybhk++BUWjFLPzkiNpc8AFPgVwRtfbfiWm5rV7RWPFclerb9r1wrX2UM68SbVAtoqNUSLvX48787ngqFK3zUb6mbc6ithyq2K5G9G3PfVZ1d\/AM1Z6vlTxhU3OzXc0dJWIUa1vu5bbNU2fjWWSumrML2049ZU7HH1jGHVu1bVnQqu5sa9veqRZ5yqHmjZlq3P+evdy7nVvM2mGU9mxx7XzFanzxWC4UGVjRulD1TIU68u95qKdYVWdLKZn\/2qi4dmZ3DuXZ0iJuNBactUy1tl3NVf9p7iQR+xUd8vn8a3xhVW8zHXeOckpYhEZVwrL83LKJ\/fbnPpfVWKzokEPd8\/LdXywsbetwWlV3uHEltklXd4jb9jvCH1uKa1cuxnfHVWWn8WqF\/2cLb3bMJu483C5ZibJKnqkRFufjl7atR9GrY3SXq5lbsb+yq6rU+GjP8J1j6I9W1B4fY8Tar\/Wc+47HzzarehNUVqPcK4uEVyu6+KC6i73bR+brqxSZv1jNq3PFHawWOt7i\/tz77vGUPWlV7xqdT2T3eNf6UbFW+824SIx57T52e8zSxdYz\/0vatlv52hk63ys6a2RVb8sOPCHdI\/BTJgNr+wA\/GwdBPxiI56GMz75Y6oPvG\/0QKcDfOSdDtiqZIn4ioh9+FH4gpCF4rwHQH99NOPjopeJOUoXzJeOnVnySxNneeccXicz3n84JzmWK3VnbFhfKKWhTsy3XaaLI0MoZOla9Z1WqN3i+P5WTtFq02IQHJuGz\/dzgUcXfrPg94b+md7KQ579dKBmfDpEhuK+SxdkzQ0SJcp9IapP8352hVtwBFFnr\/8os7rbkLvHYNnbu\/CrrTEuRVX5azi21yjmVFZUOrJJHVFZXVVZbHLbKCrmqrChJzrQ4LH8ilMwHkydVltXwGrs8pgL79R08OKUPPlKT5IyyMnmiraTUYZcnWu3W6rnW4hGVFQ5rOR+ker5st2AnrLfNlIutdltJRaKcUW2zlMlFKGWxYWN5ZbVVLq0pt1TY7A65qNRSbSlyYAe7w1Zklx2llgoZ2+bLlTNlG85SVW0tthZZ7fbKartsqSiWLTh+TVGpbFOHslXIjpoKq1xrc5RidyvWVhbz3pwvs+Ac2N+CyrjrHLXWCofNitJFyNRUz0+ShUkq51qrLbg8R7XV4ijHJt6hqAaXaOeT2StnoppChZk1ZWXICl1x+vJKnMRWUVxjd4il2h3zy6wdLcGdY+ezWKvLbRVCorpyNg5rQf2LanCiCqFZsc1SUsnba0ttuMJSa1kVWqRSLrHNtQoB4WWLXIbmkMutaLsKWxGKW6qqrGjGiiIrTqKY28aNJVvn4WLKrWXzZVybHZ1cxscot5UJ8zrUuLGr8xVhj0KrXGO3FivWtM6p4crWFHH7yzMrcck4Ii7K4bBVlPClV1vR7w57IneTHU0m4giL5ZYSy+22Chza6ihKVIyG3Ytt9qoyy3w+Be9dYa21V1mqUDUUKUYVHTY7H5iLV1VXlleK0ZLcsTpEWdpEa0lNmaV6yBTsx6M2NWlQqtwrx1ZUXcl91FtI5eQKsl3OrUbfl1uqZ\/MV\/1Hk41pKMAitGG8iplB08iR5vMUhm+TcHHnczJlJQjFrmd1aW4piSWPH5Y4ZOWZERu6YcWPlcSPlm8eMyBo7KUvOGDUxKysna2yuj6ePZ24pusJtae4WPjAuDlftEF5o0wd3XmVJtaWqdL6Yhwc\/t1PhfHl+ZQ3vWcQjFLWrqSgW0YcxgQEl4hpjwobRjOKWkmqrlUdvkpyH3UotGDqVhXzrYU9HJ2W4tWp5CFrR2VbunWprkQNjYybavl0v7vbKEqsQEWHR1g\/diRFfWOPAoVHNStyFHRbU0+5WCoO\/zRRtnXmEynMtZTWWQoxKix2jqmPvJHlyhYjz+e5V4JpU5+CWsMj2KmuRbaat6NqVy2jFChGhvK+luNjGfYyRUy0SVyKvrha2FRmhi1JltnIbXxBOIuRqK6tn25XAFjEsKitrMWZqCsts9lI+D46lmLscgxv1R1dVzZeVgFct1HkiYY8xM9sXxzPenBqrXUyDubLIWl2hrqBa1VsI20sra8qKMVbn2qy1Soq7ZvlcDj1pxaxR3J4W29aIaolkXORo9zFfmEXVeubvDytUbuug5gp1IJzH4hjCBSZPypD7yL0G9RvYWx7Yd1CflH4pKR4ek7OxMqVv33798DkwbaA8cED\/wf0H+3iWOhxVQ5KTa2trk8rdji+qLO+4J6xyZrWlltsCtyAqhSNNrCzEHToWc1YlJvhEvkmrbUU2izzJIvaGHU+sQan\/YezkUkd5WXK5g\/9vrMnl9hkWnieSeOVf7FBrLcNa65934aVk1Y5CGi9DleI12CJ+\/eF8cU2aT3zwMJ+F5e\/EVcDdPklcFvmViF9aiqUNUoP0onQIcUA6KD3TYSyLuBi4y1+Isa2d5rJ2Gk2MxyJZX5bNRrEb8TkYpS3iFbFYvY6UEifZIoG44vFvwlSL6xkfA+D\/ADCc9jxlbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwgL0ZpbHRlciAvRmxhdGVEZWNvZGUgL0xlbmd0aCAyNjggPj4Kc3RyZWFtCnicXZHLSsQwFIb3eYqzHBdD7x0HSkFGhC68YPUB0uS0BmwS0nTRtzeXWsFAAh\/n\/88tya177KSwkLwZxXq0MArJDS5qNQxhwElIkuXABbM7hZfNVJPEmfttsTh3clSkaQCSdxddrNng9MDVgHckeTUcjZATnD5vveN+1fobZ5QWUtK2wHF0mZ6pfqEzQhJs5467uLDb2Xn+FB+bRsgDZ7EbpjgumjI0VE5ImtSdFpond1qCkv+L19E1jOyLmqAunDpN87T1lF8ClWWka6Q6UBGVVVQWUVlFZXkfqK5CzT179lvraK2qoyl6L8WujnHfrF\/qsQm2GuOWEDYfpvdzC4nH52ilvcvfH4q6ihNlbmRzdHJlYW0KZW5kb2JqCjEwIDAgb2JqCjw8IC9UeXBlIC9PYmpTdG0gL0xlbmd0aCA0NzUgL0ZpbHRlciAvRmxhdGVEZWNvZGUgL04gNiAvRmlyc3QgMzcgPj4Kc3RyZWFtCnicdVJLb9swDL7vV\/DYHKKnJVlAESBpljUY0hVNth6GHtRY84Q5lmErwPLvRznNlh4GwzBAfuT3oDkHBlyA5MAlGAW8AGuBKxAcPxqU1B9ub4E+9rE67n0PN9tfwdHH5QoO2k5gNhvbd\/HYJuBAP4dqgO+gce0TvADdnTqP0672wwW72AB9iP3BNUD3DocudTf4VcQ1dN4H12x2QJd+2Pu2cm3KjbwYlb1t\/tjuYxXaGui68m0K6TS9B7o9vqaRMhMz\/MSvbUCgBzsOvgkaef7Pe7debk9D8od1+yNCBn3pK99ntpsL2wTok6\/DkPoT3Myr+Oonmb7rGn9ABLLNZuOmXfy0Xm5c908oGnvG\/qgiW+xDl2Kf4x4l\/vWAwxmSJYt3yukzRsHwNYpBfoQxpJSCSUxG2twQgnBtrMGm5gybtiywqXi+jtbE2nzh8\/Q1wAgEKKUJV0LmQqlzgb3neLmEN88HSmCZIsLIokDRrrv3of6ZwHBFSsTzyyETTAXnxPKCaXTSuHqA4mxpsYi\/kWeqdUGUYqaEqRQFMcwgn2CiJCMzZ9IQzqws8y+QB1ehwXDKc3K58OAO\/uqU6+SasJ+3deNz5Fs86jcoUBjaxS1XqV5dAs39AdXT14NlbmRzdHJlYW0KZW5kb2JqCjEgMCBvYmoKPDwgL1R5cGUgL1hSZWYgL0xlbmd0aCAxNiAvRmlsdGVyIC9GbGF0ZURlY29kZSAvRGVjb2RlUGFybXMgPDwgL0NvbHVtbnMgNCAvUHJlZGljdG9yIDEyID4+IC9XIFsgMSAyIDEgXSAvU2l6ZSAyIC9JRCBbPDIxYTZlMTdlZDNhOTExZDY0MmQ5NGE0ZjU5NmQ1OTBkPjwyMWE2ZTE3ZWQzYTkxMWQ2NDJkOTRhNGY1OTZkNTkwZD5dID4+CnN0cmVhbQp4nGNiAAImRpspDAACCADWCmVuZHN0cmVhbQplbmRvYmoKICAgICAgICAgICAgICAgCnN0YXJ0eHJlZgoyMTYKJSVFT0YK'
              }
              
            ]
          }

          //Second api call for sending mail nested in async get mail call
          client
          .api('users/me/sendMail')
          .post(
          { message: mail },
          (err, res) => {
            if (err) {
              console.log(err);
            }
            else {
              console.log("Sent an email to: " + userEmail);
            }
          });
          //end second api call
        }
      });
    }
    //If no access token
    else {
      alert("couldn't send mail, no access token!!");
    }
  });
}

  // HELPER FUNCTIONS ============================
  function guid() {
    var buf = new Uint16Array(8);
    cryptObj.getRandomValues(buf);
    function s4(num) {
      var ret = num.toString(16);
      while (ret.length < 4) {
        ret = '0' + ret;
      }
      return ret;
    }
    return s4(buf[0]) + s4(buf[1]) + '-' + s4(buf[2]) + '-' + s4(buf[3]) + '-' +
    s4(buf[4]) + '-' + s4(buf[5]) + s4(buf[6]) + s4(buf[7]);
  }

  function parseHashParams(hash) {
    var params = hash.slice(1).split('&');

    var paramarray = {};
    params.forEach(function(param) {
      param = param.split('=');
      paramarray[param[0]] = param[1];
    });

    return paramarray;
  }

  function decodePlusEscaped(value) {
  // decodeURIComponent doesn't handle spaces escaped
  // as '+'
    if (value) {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    } else {
      return '';
    }
  }

  function clearUserState() {
    // Clear session
    sessionStorage.clear();
  }

  function clearSentUsers() {
    //Get list of users from document
    var elems = $('#user-list').children().find(".user-login");

    for (let i = 0; i < elems.length; i++) {
      //Remove those which have been sent
      if ($(elems[i]).parent().hasClass('list-group-item-success')) {
        $(elems[i]).parent().remove();
      }
    }
  }

  /**
   * Sends progress reports to selected users synchronously
   */
  async function sendProgressReports() {
    var userArr = [];

    //Get list of users from document
    var elems = $('#user-list').children().find(".user-login");

    for (let i = 0; i < elems.length; i++) {
      //Check to make sure progress report hasn't been sent yet
      //Parent div contains styling
      if (!$(elems[i]).parent().hasClass('list-group-item-success')) {
        userArr.push(elems[i].textContent);
      }
    }

    console.log('Will send reports to: ', userArr);
    
    var query = "";

    var sendReportParam = 
        {
            createdBy: "reportBot", 
            createdDate: new Date(),
            users: []
        };

    for (let i = 0; i < userArr.length; i++) {
        sendReportParam.users = [];
        sendReportParam.users.push(userArr[i]);
        query = userArr[i].replace( /(:|\.|\[|\]|,|=|@)/g, "\\$1");


        // wait for the promise to resolve before advancing the for loop
        await $.when(
                //query the API to send progress report
                $.ajax({
                url:"https://joeyalbano.com:8080/https://math.afficienta.com/mathjoy/api/v1.0/sendProgressReportToUsers",
                type:"POST",
                data:JSON.stringify(sendReportParam),
                contentType:"application/json; charset=utf-8",
                dataType:"json",
                success: function(response){
                    console.log('Successfully sent progress report to: ' + sendReportParam.users[0]);
                    $(query).removeClass().addClass("list-group-item list-group-item-success");
                  }
                })
              ).done(function(response1) {
              })
              .fail(function(err) {
                console.log('Failed to send progress report to: ', userArr[i], ' because of: ',err);
                $(query).removeClass().addClass("list-group-item list-group-item-danger");
              })
    }

    console.log('done');

  }

  Handlebars.registerHelper("formatDate", function(datetime){
    // Dates from API look like:
    // 2016-06-27T14:06:13Z
    var date = new Date(datetime);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  });

  // ADMINISTRATIVE FUNCTIONS ===============
  /**
  * Gets user list for progress reports 
  * 
  * @return String[] of usernames 
  */
  function getProgressReportUsers(callback) {
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
        $('#num-eligible-progress-reports').text(finalArr.length);
        callback(finalArr, null);
    })
    .fail(function(err) {
        console.log(err);
        callback(null, err);
    })

  }

});




/*
studentName + "'s" 1 Month Progress 

Hi parentName,  

Hope you're having a goodOrGreat week! I'm thrilledWord to say that Ryan has done workDescription since joining Afficient Academy!  

studentName is a very bright student, studentGender niceObservation1. studentGender criticalObservation1. solution1. criticalObservation2. criticalObservation3. solution2. solution3, encouragement1!  

We are very proud of studentName and we thank you for choosing Afficient Academy!  

Once again, thank you for being a part of Afficient Academy and we look forward to helping studentName continue to grow!

studentName
studentGender
parentName
goodOrGreat = ["good", "great"]
jobDescription = ["a tremendous job", "such a good job", "such a great job", "an excellent job", "an impressive amount of work", "such great work", "such good work"]
thrilledWord = ["excited", "thrilled", "delighted"]
brightWord = ["bright", "able", "sharp", "capable"]

*/