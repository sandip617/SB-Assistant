import Foundation
import CoreGraphics
guard let h = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_NOW),
      let g = dlsym(h, "DisplayServicesGetBrightness"), let s = dlsym(h, "DisplayServicesSetBrightness") else { exit(2) }
typealias Get = @convention(c) (UInt32, UnsafeMutablePointer<Float>) -> Int32
typealias Set = @convention(c) (UInt32, Float) -> Int32
let id = CGMainDisplayID(); var v: Float = 0
guard unsafeBitCast(g, to: Get.self)(id, &v) == 0 else { exit(3) }
if CommandLine.arguments.count > 1, let p = Float(CommandLine.arguments[1]), p >= 0, p <= 100 {
  guard unsafeBitCast(s, to: Set.self)(id, p / 100) == 0 else { exit(4) }
  v = p / 100
}
print(Int((v * 100).rounded()))
