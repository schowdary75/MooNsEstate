import axios from "axios";
import { constant } from "constant";

export const postApi = async (path: string, data?: any, login?: boolean) => {
  try {
    let result = await axios?.post(constant?.baseUrl + path, data, {
      headers: {
        Authorization:
          localStorage.getItem("token") || sessionStorage.getItem("token"),
      },
    });
    if (result?.data?.token && result?.data?.token !== null) {
      if (login) {
        localStorage.setItem("token", result?.data?.token);
      } else {
        sessionStorage.setItem("token", result?.data?.token);
      }
      localStorage.setItem("user", JSON.stringify(result?.data?.user));
    }
    return result;
  } catch (e) {
    console.error(e);
    return e;
  }
};

export const postApiBlob = async (path: string, data: any = {}) => {
  try {
    let result = await axios?.post(constant?.baseUrl + path, data, {
      headers: {
        Authorization:
          localStorage.getItem("token") || sessionStorage.getItem("token"),
      },
      responseType: "blob",
    });

    return result;
  } catch (e) {
    console.error(e);
    return e;
  }
};

export const putApi = async (path: string, data?: any, id?: string) => {
  try {
    let result = await axios?.put(constant?.baseUrl + path, data, {
      headers: {
        Authorization:
          localStorage.getItem("token") || sessionStorage.getItem("token"),
      },
    });
    return result;
  } catch (e) {
    console.error(e);
    return e;
  }
};

export const deleteApi = async (path: string, param: string = "") => {
  try {
    let result = await axios?.delete(constant?.baseUrl + path + param, {
      headers: {
        Authorization:
          localStorage.getItem("token") || sessionStorage.getItem("token"),
      },
    });
    if (result?.data?.token && result?.data?.token !== null) {
      localStorage.setItem("token", result?.data?.token);
    }
    return result;
  } catch (e) {
    console.error(e);
    return e;
  }
};

export const deleteManyApi = async (path: string, data?: any) => {
  try {
    let result = await axios?.post(constant?.baseUrl + path, data, {
      headers: {
        Authorization:
          localStorage.getItem("token") || sessionStorage.getItem("token"),
      },
    });
    if (result?.data?.token && result?.data?.token !== null) {
      localStorage.setItem("token", result?.data?.token);
    }
    return result;
  } catch (e) {
    console.error(e);
    return e;
  }
};

export const getApi = async (path: string, id?: string) => {
  try {
    if (id) {
      let result = await axios?.get(constant?.baseUrl + path + id, {
        headers: {
          Authorization:
            localStorage.getItem("token") || sessionStorage.getItem("token"),
        },
      });
      return result;
    } else {
      let result = await axios?.get(constant?.baseUrl + path, {
        headers: {
          Authorization:
            localStorage.getItem("token") || sessionStorage.getItem("token"),
        },
      });
      return result;
    }
  } catch (e) {
    console.error(e);
    return e;
  }
};
