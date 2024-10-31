import React from "react";
import UserAvatar from "./UserAvatar";
import UserBio from "./UserBio";

const UserInfo = () => {
  return (
    <div>
      <h2>User Info</h2>
      <UserAvatar />
      <UserBio />
    </div>
  );
};

export default UserInfo;
