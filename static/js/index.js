'use strict';

const padModals = require('ep_etherpad-lite/static/js/pad_modals.js').padmodals;

const padModalShow = (message, delay, status) => {
  let notificationPopupId = "#notification-popup-id";
  $(`${notificationPopupId} p`).text(message);
  $(`${notificationPopupId} h2`).text("Success");

  padModals.showModal("ep_sciencemesh-popup");
  padModals.hideOverlay();

  // style classes get overwritten at handleClientMessage_CUSTOM
  if (status >= 200 && status < 400) $('#notification-popup-id h2').addClass('notify_success');
  else if (status >= 400) $('#notification-popup-id h2').addClass('notify_error');

  if (delay === 0) {
    $("#connectivity").click(() => $('#connectivity').hide());
  }
  else {
    $("#connectivity").delay(`${delay*1000}`).fadeOut('slow');
  }
}

exports.handleClientMessage_CUSTOM = (hook, context, cb) => {
  if (context.payload.action === 'recieveNotificationMessage') {

    const message = context.payload.message;
    if (message) {
      let notification = message;

      if (Object.keys(notification).length === 3) {
          let { message, delay, status } = notification;

          if (status >= 200 && status < 400) {
            $('#notification-popup-id h2').text("Success");
            padModalShow(message, delay, status);
          }
          else if (status >= 400) {
            $('#notification-popup-id h2').text("Error");
            padModalShow(message, delay, status);
          }
        }
      }
    }
  cb(null);
};
