---
layout: post
title: "3x-ui安装指南+搭建reality+申请ssl证书"
date: 2026-08-04 21:40:00 +0800
tags: ["科学知识"]
canonical: https://aunger.eu.org/feed/5
hidden: true
sitemap: false
---

<!-- rin-sync-managed -->
## 1 前言
很久以前出过x-ui的视频和博客内容，但是由于时间过于久远，包括在技术上和更新上都有了一些变化，这里就重新写一下。

事情的起因是我以前写过的一个教程：X-ui面板安装以及ssl申请
里面的github项目已经两年多没有更新了，当初x-ui的项目可谓是百花齐放，到现在剩余的项目确实不多了，目前稳定更新好用的x-ui面板就是今天要介绍的这个，伊朗作者的。
伊朗的哥们真的是人才辈出，目前还在维护的有今天介绍的基于xray核心x-ui项目魔改的3x-ui。
还有基于sing-box项目的web程序：https://github.com/alireza0/s-ui，
还有另一个基于sing-box项目的下web程序，我以前写博客讲过： Hiddify-Manager安装教程和使用指南 超越X-UI
还有另一个https://github.com/Gozargah/Marzban
这几个有时间都再讲讲或者出视频。

不过从另一个角度考虑，后续的几个项目在易用性上都很抽风，不愧是程序员出品的项目，用起来完全就没考虑过美观和易用性，实用价值最高的还是x-ui系列，所以还是优先推荐3x-ui项目。
**3x-ui的特色：**
- 系统状态监控
- 在所有入口和客户端中搜索
- 深度/浅色主题
- 支持多用户和多协议
- 支持多种协议，包括VMess、VLESS、Trojan、小火舰、Dokodemo-door、Socks、HTTP、wireguard
- 支持XTLS协议，包括RPRX-Direct、Vision、REALITY
- 流量统计、流量限制、超时时间限制
- 可自定义的 Xray 配置模板
- 支持HTTPS访问面板（自建域名+SSL证书）
- 支持一键式SSL证书申请和自动续费
- 更多高级配置项目请参考面板
- 修复了API路由（用户设置将使用API创建）
- 支持通过面板中提供的不同项目更改配置。
- 支持从面板导出/导入数据库

**1.1 3x-ui介绍**
3x-ui项目地址：[*https://github.com/MHSanaei/3x-ui*](https://github.com/MHSanaei/3x-ui)
基于x-ui后续魔改版本，和其余的x-ui魔改项目类似的是后续也更新了内核，并且支持了新的协议，支持多用户。不过3x-ui后续更新的实用功能是可以对xray核心进行修改，这点后续会讲。3x-ui在美观程度和动画流畅程度上和其余的搭建代理面板拉开了一个维度。


## 2 安装3x-ui
**2.1 安装BBR**
安装3x-ui前记得安装bbr加速，看这里：BBR新版脚本以及优化
“Enable BBR” 是一种优化网络性能的操作，通常用于加速数据传输。
BBR (Bottleneck Bandwidth and Round-trip propagation time) 是由 Google 开发的一个拥塞控制算法，用于提高 TCP 网络传输速度，尤其在高延迟和高丢包环境下显著提升网络吞吐量。BBR 通过优化带宽和延迟的控制逻辑，使得数据传输更高效、延迟更低，因此在网络加速和 VPS 等应用中非常受欢迎。

开启 BBR 的操作步骤
在支持 BBR 的 Linux 系统（如 CentOS 7+ 或 Ubuntu 16.04+）上，可以通过以下步骤来启用：
检查内核版本：BBR 支持 Linux 内核版本 4.9 及以上。

- 可以通过以下命令查看当前内核版本：
```
uname -r
```

- 启用 BBR：
在终端中执行以下命令来启用 BBR：
```
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

验证 BBR 是否成功启用：
执行以下命令，确认 BBR 已被启用：
```
sysctl net.ipv4.tcp_available_congestion_control
```

输出结果应包含 bbr，表示 BBR 已成功启用。可以再运行以下命令进一步确认：
```
lsmod | grep bbr
```

如果输出包含 tcp_bbr 模块，则说明 BBR 已经在系统中启用。
启用 BBR 后，x-ui 项目的网络连接稳定性和速度通常会得到明显提升。

**2.2 安装3x-ui**
安装脚本：
```
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

在运行脚本以后，会提示你
`Do you want to continue with the modification y/n?`
这里的意思是是否要进行自定义配置，可以进行用户名和密码的自定义设置等，建议输入y进行自定义配置。
```
Please set up your username: 后面输入要设置的面板用户名
Please set up your password: 后面输入要设置的面板密码
Please set up the panel port: 后面输入你要设置的面板端口
```

然后就安装完成了，以后想要在ssh连接里面进行3x-ui的设置，只需要输入x-ui然后回车就会出现3x-ui的管理面板，
如下：
```

[root@hcss-ecs-9fd1 local]# x-ui
The OS release is: centos


3X-UI Panel Management Script
0. Exit Script
————————————————
1. Install
2. Update
3. Update Menu
4. Custom Version
5. Uninstall
————————————————
6. Reset Username & Password & Secret Token
7. Reset Web Base Path
8. Reset Settings
9. Change Port
10. View Current Settings
————————————————
11. Start
12. Stop
13. Restart
14. Check Status
15. Logs Management
————————————————
16. Enable Autostart
17. Disable Autostart
————————————————
18. SSL Certificate Management
19. Cloudflare SSL Certificate
20. IP Limit Management
21. Firewall Management
————————————————
22. Enable BBR 
23. Update Geo Files
24. Speedtest by Ookla


Panel state: Running
Start automatically: Yes
xray state: Running


Please enter your selection [0-24]: 9


Enter port number[1-65535]: 19528 
Port set successfully: 19528
The port is set, Please restart the panel now, and use the new port 19528 to access web panel


Restart the panel, Attention: Restarting the panel will also restart xray [Default y]: y
[INF] x-ui and xray Restarted successfully 




Press enter to return to the main menu: 
输入数字9以重置端口号，1～65535（Linux端口范围
输入数字6以重置用户名密码， 6. Reset Username & Password & Secret Token

```

接下来我们就可以结束令人头疼的ssh设置，到简单容易操作的ui界面里面进行设置。

**2.3 x-ui网页端**
在浏览器输入你vps的IP，后面加上英文冒号，然后跟上你设置的端口，格式如下：IP:端口 172.12.34.125:19528
进入后在下方的语言设置里面设置为中文。然后输入你的用户名和密码进入。


最上方会提示你此连接不安全。在激活 TLS 进行数据保护之前，请勿输入敏感信息。
这里不用管，后续到了配置代理的时候在选择。主界面会显示一些信息：x-ui版本/IP地址/xray版本切换/瞬时网络流量/总共用了多少流量/连接数等等，方便查看。

## 3 使用
**3.1 简单搭建reality**
在所有的FQ协议里面，我最喜欢的就是reality协议，足够安全并且不需要自己的域名。如果需要自己的域名那么还得申请ssl，这里我们就简单示意一下reality的搭建
点击左侧的入站列表，然后点击添加入站

很多默认配置不需要修改，需要修改的几个栏目
备注，这个随便写，就是节点名字。
协议，默认就是vless，如果搭建reality协议就选vless。
端口，最好是443，当然随便一个也行。
传输，选tcp。
安全，选中reality。
然后关于私钥和公钥，点一下下面的 Get New Cert按钮就可以随机获取私钥和公钥。
然后点击右下角的添加，就完成了一个reality节点的搭建。

**3.2 入站列表 栏目**
在入站列表栏目里面，上面是显示流量和用户等信息，下方是节点信息。可以看到我们已经搭建好了一个节点，节点的类型是vless tcp Reality这三个标签，关于如何导出节点链接，可以点击节点前方的三个点，然后点击导出链接，然后点击复制即可。

**3.3 客户端：**
Windows（v2rayN）：[https://github.com/2dust/v2rayN](https://github.com/2dust/v2rayN)
Android（v2rayNG）：[https://github.com/2dust/v2rayNG](https://github.com/2dust/v2rayNG)
IOS（shadowrocket）：[https://apps.apple.com/app/shadowrocket/id932747118](https://apps.apple.com/app/shadowrocket/id932747118)

**3.3 客户端错误解决**
启动服务(2024年10年27 00:50:46)...
D:\v2rayN\guiConfigs\configSpeedtest.json
Xray 24.10.16 (Xray, Penetrates Everything.) 25c7bc0 (go1.23.2 windows/amd64)
A unified platform for anti-censorship.
Failed to start: app/proxyman/inbound: failed to listen TCP on 10829 > transport/internet: failed to listen on address: 127.0.0.1:10829 > transport/internet/tcp: failed to listen TCP on 127.0.0.1:10829 > listen tcp 127.0.0.1:10829: bind: An attempt was made to access a socket in a way forbidden by its access permissions.
2024年10年27 00:50:46 运行Core失败，请看日志
https://stackoverflow.com/questions/10461257/an-attempt-was-made-to-access-a-socket-in-a-way-forbidden-by-its-access-permissi

**3.4 成功细节**

## 4 3x-ui特色
下面就是说一下为什么我要在写一篇博客介绍和x-ui类似的3x-ui项目，3x-ui有自己的xray设置，可以设置的东西很多。
常规可以设置的东西如下：
简单讲一下可以设置什么
• 屏蔽BT协议/私有IP/广告/黄色网站/测速网站
• 屏蔽连接到伊朗/中国/俄罗斯/越南的IP或者域名
• 直连伊朗/中国/俄罗斯/越南的IP或者域名
• 通过 IPv4 将流量路由到谷歌或者netflix
• 自动配置warp，流量出站将通过cloudflare的warp进行代理。
• 设置路由规则。
• 设置出站规则，这里可以配置链式代理。
• 负载均衡等。

## 5 关于ssl证书
3x-ui和其余的x-ui魔改类似，都可以很简单的申请证书，包括cloudflare自动申请证书，不过我们这里基本都是手动申请。开启面板ssl和节点开启ssl都需要证书，所以我们再讲一下如何申请证书。

在ssh界面输入x-ui，弹出的列表里面，找到SSL Certificate Management对应的编号，我这个版本是16，那就输入16，然后回车。
get ssl 代表申请证书。
revoke 是撤销
Force Renew 定时任务续签
我们输入1，然后回车。
提示Please enter your domain name: 后面输入你的域名
提示please choose which port do you use,default will be 80 port:直接默认回车
然后等待证书申请完成
完成后会输出一些信息，包括如下
Your cert is in:
Your cert key is in:
The intermediate CA cert is in:
And the full chain certs is there:

其中我们需要注意的是Your cert is in和Your cert key is in。Your cert is in:后面显示的内容是你的证书，Your cert key is in: 后面的显示内容是你的密钥，一般后面的有效内容会高亮显示。

**5.1 配置面板ssl**
我们回到面板，点击面板设置，在面板证书公钥文件路径里面粘贴你的公钥路径，在面板证书密钥文件路径里面填写你的私钥路径，然后在面板 url 根路径里面随便写一个路径，比如我这里写的是/panel

然后点击上方的保存，然后点击重启面板。
后续我们会发现通过IP直接访问进不去面板了，这很正常。现在我们需要通过https://你的域名:你设置的端口/你设置的路径 进入，这样可以有效提高面板的安全性。

**5.3 节点配置ssl**
接下来就很简单了，假如说我们需要一个带tls的节点，比如vmess+ws+tls，我们去入站列表新建一个配置，需要修改的是协议选择vmess，传输选择websocket，安全选择tls，然后点击下面的从面板设置证书，再点击下面的添加。就完成了一个vmess+ws+tls节点的创建。


---


博客原文：[https://www.duangvps.com/archives/2054](https://www.duangvps.com/archives/2054)
链接原文：[https://www.cnblogs.com/JourneyOfFlower/p/18314466](https://www.cnblogs.com/JourneyOfFlower/p/18314466)
