/* Pure curve algorithms extracted from the user-provided ManualTracker 2.3.0.
   Adobe host calls are intentionally outside this module. See licenses/ATTRIBUTION.md. */
(function(root){
"use strict";
    function distance(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function lerpPoint(a, b, t) {
        return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
    }
    function catmullPoint(p0, p1, p2, p3, t) {
        var t2 = t * t;
        var t3 = t2 * t;
        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    }
    function denseCatmull(samples) {
        if (samples.length < 3) {
            return samples.map(function (sample) { return sample.position; });
        }
        var dense = [];
        for (var i = 0; i < samples.length - 1; i += 1) {
            var p0 = samples[Math.max(0, i - 1)].position;
            var p1 = samples[i].position;
            var p2 = samples[i + 1].position;
            var p3 = samples[Math.min(samples.length - 1, i + 2)].position;
            for (var step = 0; step < 20; step += 1) {
                dense.push(catmullPoint(p0, p1, p2, p3, step / 20));
            }
        }
        dense.push(samples[samples.length - 1].position);
        return dense;
    }
    function resampleByArc(points, count) {
        if (points.length < 2 || count < 2) { return points.slice(); }
        var cumulative = [0];
        for (var i = 1; i < points.length; i += 1) {
            cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
        }
        var total = cumulative[cumulative.length - 1];
        if (total === 0) {
            return Array(count).fill(null).map(function () { return {x: points[0].x, y: points[0].y}; });
        }
        var output = [];
        var segment = 1;
        for (var n = 0; n < count; n += 1) {
            var target = total * n / (count - 1);
            while (segment < cumulative.length - 1 && cumulative[segment] < target) {
                segment += 1;
            }
            var before = cumulative[segment - 1];
            var after = cumulative[segment];
            var ratio = after === before ? 0 : (target - before) / (after - before);
            output.push(lerpPoint(points[segment - 1], points[segment], ratio));
        }
        return output;
    }
    function pointAtArcProgress(points, progress) {
        if (!points.length) { return {x: 0, y: 0}; }
        if (points.length === 1 || progress <= 0) {
            return {x: points[0].x, y: points[0].y};
        }
        if (progress >= 1) {
            return {x: points[points.length - 1].x, y: points[points.length - 1].y};
        }
        var cumulative = [0];
        for (var i = 1; i < points.length; i += 1) {
            cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
        }
        var total = cumulative[cumulative.length - 1];
        if (total === 0) {
            return {x: points[0].x, y: points[0].y};
        }
        var target = total * progress;
        var segment = 1;
        while (segment < cumulative.length - 1 && cumulative[segment] < target) {
            segment += 1;
        }
        var before = cumulative[segment - 1];
        var after = cumulative[segment];
        var ratio = after === before ? 0 : (target - before) / (after - before);
        return lerpPoint(points[segment - 1], points[segment], ratio);
    }
    function cumulativeDistances(points) {
        var cumulative = [0];
        for (var i = 1; i < points.length; i += 1) {
            cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
        }
        return cumulative;
    }
    function pchipEndpointSlope(h0, h1, delta0, delta1) {
        var slope = ((2 * h0 + h1) * delta0 - h0 * delta1) / (h0 + h1);
        if (slope * delta0 <= 0) { return 0; }
        if (delta0 * delta1 < 0 && Math.abs(slope) > Math.abs(3 * delta0)) {
            return 3 * delta0;
        }
        return slope;
    }
    function pchipSlopes(points) {
        var count = points.length;
        var slopes = [];
        var intervals = [];
        var deltas = [];
        var i;
        if (count === 2) {
            var onlyDelta = (points[1].speed - points[0].speed) /
                (points[1].time - points[0].time);
            return [onlyDelta, onlyDelta];
        }
        for (i = 0; i < count - 1; i += 1) {
            intervals[i] = points[i + 1].time - points[i].time;
            deltas[i] = (points[i + 1].speed - points[i].speed) / intervals[i];
        }
        slopes[0] = pchipEndpointSlope(
            intervals[0], intervals[1], deltas[0], deltas[1]
        );
        for (i = 1; i < count - 1; i += 1) {
            if (deltas[i - 1] * deltas[i] <= 0) {
                slopes[i] = 0;
            } else {
                var weight1 = 2 * intervals[i] + intervals[i - 1];
                var weight2 = intervals[i] + 2 * intervals[i - 1];
                slopes[i] = (weight1 + weight2) /
                    (weight1 / deltas[i - 1] + weight2 / deltas[i]);
            }
        }
        slopes[count - 1] = pchipEndpointSlope(
            intervals[count - 2], intervals[count - 3],
            deltas[count - 2], deltas[count - 3]
        );
        return slopes;
    }
    function evaluateSpeedCurve(points, time, slopes) {
        var t = Math.max(0, Math.min(1, time));
        if (t <= points[0].time) { return Math.max(0, points[0].speed); }
        if (t >= points[points.length - 1].time) {
            return Math.max(0, points[points.length - 1].speed);
        }
        var segment = 0;
        while (segment < points.length - 2 && points[segment + 1].time < t) {
            segment += 1;
        }
        var left = points[segment];
        var right = points[segment + 1];
        var width = right.time - left.time;
        var u = (t - left.time) / width;
        var u2 = u * u;
        var u3 = u2 * u;
        var value = (2 * u3 - 3 * u2 + 1) * left.speed +
            (u3 - 2 * u2 + u) * width * slopes[segment] +
            (-2 * u3 + 3 * u2) * right.speed +
            (u3 - u2) * width * slopes[segment + 1];
        return Math.max(0, value);
    }
    function buildSpeedProgressLut(points, steps) {
        var sorted = points.slice().sort(function (a, b) { return a.time - b.time; });
        if (sorted.length < 2) { throw new Error("速度曲线至少需要两个点。"); }
        var slopes = pchipSlopes(sorted);
        var count = Math.max(100, Number(steps) || 600);
        var lut = [{time: 0, progress: 0, speed: evaluateSpeedCurve(sorted, 0, slopes)}];
        var area = 0;
        var previousSpeed = lut[0].speed;
        for (var i = 1; i <= count; i += 1) {
            var time = i / count;
            var speed = evaluateSpeedCurve(sorted, time, slopes);
            area += (previousSpeed + speed) * 0.5 / count;
            lut.push({time: time, progress: area, speed: speed});
            previousSpeed = speed;
        }
        if (area <= 0.000001) {
            throw new Error("速度曲线的总速度为 0，无法到达轨迹终点。");
        }
        lut.forEach(function (entry) {
            entry.progress /= area;
            entry.speed /= area;
        });
        lut[lut.length - 1].progress = 1;
        return lut;
    }
    function speedProgressAtTime(lut, time) {
        var index = Math.max(0, Math.min(lut.length - 1,
            Math.round(Math.max(0, Math.min(1, time)) * (lut.length - 1))));
        return lut[index].progress;
    }
    function timeAtSpeedProgress(lut, progress) {
        var target = Math.max(0, Math.min(1, progress));
        var low = 0;
        var high = lut.length - 1;
        while (low + 1 < high) {
            var middle = Math.floor((low + high) / 2);
            if (lut[middle].progress < target) { low = middle; } else { high = middle; }
        }
        var before = lut[low];
        var after = lut[high];
        var span = after.progress - before.progress;
        var ratio = span === 0 ? 0 : (target - before.progress) / span;
        return before.time + (after.time - before.time) * ratio;
    }
    function cubicBezierPoint(start, control1, control2, end, t) {
        var inverse = 1 - t;
        var inverse2 = inverse * inverse;
        var t2 = t * t;
        return {
            x: inverse2 * inverse * start.x +
                3 * inverse2 * t * control1.x +
                3 * inverse * t2 * control2.x + t2 * t * end.x,
            y: inverse2 * inverse * start.y +
                3 * inverse2 * t * control1.y +
                3 * inverse * t2 * control2.y + t2 * t * end.y
        };
    }
    function perpendicularDistance(point, start, end) {
        var length = distance(start, end);
        if (length === 0) { return distance(point, start); }
        return Math.abs((end.y - start.y) * point.x - (end.x - start.x) * point.y +
            end.x * start.y - end.y * start.x) / length;
    }
    function rdp(samples, epsilon) {
        if (samples.length < 3) { return samples.slice(); }
        var maxDistance = 0;
        var index = 0;
        for (var i = 1; i < samples.length - 1; i += 1) {
            var value = perpendicularDistance(
                samples[i].position,
                samples[0].position,
                samples[samples.length - 1].position
            );
            if (samples[i].locked) { value = Infinity; }
            if (value > maxDistance) {
                maxDistance = value;
                index = i;
            }
        }
        if (maxDistance > epsilon) {
            var left = rdp(samples.slice(0, index + 1), epsilon);
            var right = rdp(samples.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [samples[0], samples[samples.length - 1]];
    }
root.MTCurve={distance,lerpPoint,catmullPoint,denseCatmull,resampleByArc,pointAtArcProgress,cumulativeDistances,pchipEndpointSlope,pchipSlopes,evaluateSpeedCurve,buildSpeedProgressLut,speedProgressAtTime,timeAtSpeedProgress,cubicBezierPoint,perpendicularDistance,rdp};
if(typeof module!=="undefined")module.exports=root.MTCurve;
})(typeof window!=="undefined"?window:globalThis);
